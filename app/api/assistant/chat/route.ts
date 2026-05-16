import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { requireServerEnv } from "@/lib/env";
import { ASSISTANT_TOOLS } from "@/lib/assistant/tools";
import { buildSystemPrompt } from "@/lib/assistant/systemPrompt";
import {
  executeToolCall,
  getAssistantPromptContext
} from "@/lib/assistant/toolHandlers";
import type {
  AnthropicContentBlock,
  AnthropicMessageParam,
  AnthropicMessageResponse,
  AssistantChatRequest,
  AssistantUiMessage
} from "@/lib/assistant/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function toAnthropicMessages(messages: AssistantUiMessage[]): AnthropicMessageParam[] {
  return messages.map((message) => ({
    role: message.role,
    content: message.text
  }));
}

function extractUiHistory(messages: AnthropicMessageParam[]): AssistantUiMessage[] {
  const history: AssistantUiMessage[] = [];
  for (const message of messages) {
    if (typeof message.content === "string") {
      history.push({
        id: randomUUID(),
        role: message.role,
        text: message.content,
        createdAt: new Date().toISOString()
      });
      continue;
    }

    const text = message.content
      .filter((block): block is Extract<AnthropicContentBlock, { type: "text" }> => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();
    if (!text) continue;
    history.push({
      id: randomUUID(),
      role: message.role,
      text,
      createdAt: new Date().toISOString()
    });
  }
  return history;
}

async function callAnthropic(messages: AnthropicMessageParam[], system: string) {
  const env = requireServerEnv();
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured.");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system,
      tools: ASSISTANT_TOOLS,
      messages
    })
  });

  if (!response.ok) {
    const failure = await response.text();
    throw new Error(`Anthropic request failed: ${failure}`);
  }

  return (await response.json()) as AnthropicMessageResponse;
}

async function saveConversation(conversationId: string | null | undefined, businessId: string, messages: AnthropicMessageParam[], firstUserText?: string) {
  const supabase = createSupabaseAdminClient();
  const payload = {
    business_id: businessId,
    messages,
    title: firstUserText ? firstUserText.slice(0, 80) : "Andy conversation",
    updated_at: new Date().toISOString()
  };

  if (conversationId) {
    const { data, error } = await supabase.from("assistant_conversations").update(payload).eq("id", conversationId).select("*").single();
    if (error || !data) {
      throw new Error(error?.message ?? "Unable to update the assistant conversation.");
    }
    return data.id as string;
  }

  const { data, error } = await supabase
    .from("assistant_conversations")
    .insert(payload)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "Unable to create the assistant conversation.");
  }
  return data.id as string;
}

async function logToolAction(conversationId: string, toolName: string, toolInput: Record<string, unknown>, toolResult: unknown, success: boolean) {
  const supabase = createSupabaseAdminClient();
  await supabase.from("assistant_action_log").insert({
    conversation_id: conversationId,
    tool_name: toolName,
    tool_input: toolInput,
    tool_result: toolResult,
    success
  });
}

export async function GET() {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("assistant_conversations")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ ok: true, conversation: null });
  }

  const messages = (data.messages as AnthropicMessageParam[]) ?? [];
  return NextResponse.json({
    ok: true,
    conversation: {
      id: data.id,
      title: data.title,
      messages,
      history: extractUiHistory(messages),
      updated_at: data.updated_at
    }
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as AssistantChatRequest;
  const uiMessages = body.messages ?? [];
  const routeContext = body.context;
  const promptContext = await getAssistantPromptContext(routeContext);

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        let conversationId = body.conversationId ?? null;
        let currentMessages = toAnthropicMessages(uiMessages);
        let loopCount = 0;
        let continueLoop = true;
        const system = buildSystemPrompt({
          businessName: promptContext.businessName,
          todayDate: new Intl.DateTimeFormat("en-GB", { dateStyle: "full" }).format(new Date()),
          openJobsCount: promptContext.openJobsCount,
          pendingQuotesCount: promptContext.pendingQuotesCount,
          currentRoute: routeContext?.pathname,
          currentJobSummary: promptContext.currentJobSummary
        });

        while (continueLoop && loopCount < 6) {
          loopCount += 1;
          const response = await callAnthropic(currentMessages, system);
          const assistantText = response.content
            .filter((block): block is Extract<AnthropicContentBlock, { type: "text" }> => block.type === "text")
            .map((block) => block.text)
            .join("\n")
            .trim();

          if (assistantText) {
            send({ type: "text", text: assistantText });
          }

          if (response.stop_reason === "tool_use") {
            const toolUses = response.content.filter((block): block is Extract<AnthropicContentBlock, { type: "tool_use" }> => block.type === "tool_use");
            const toolResults: AnthropicContentBlock[] = [];
            currentMessages = [...currentMessages, { role: "assistant", content: response.content }];

            conversationId = await saveConversation(conversationId, promptContext.businessId, currentMessages, uiMessages[0]?.text);

            for (const toolUse of toolUses) {
              send({ type: "tool_start", tool: toolUse.name });
              try {
                const result = await executeToolCall(toolUse.name, toolUse.input, routeContext);
                await logToolAction(conversationId, toolUse.name, toolUse.input, result, true);
                send({ type: "tool_done", tool: toolUse.name, result });
                if (result.navigation?.path) {
                  send({ type: "navigation", path: result.navigation.path });
                }
                toolResults.push({
                  type: "tool_result",
                  tool_use_id: toolUse.id,
                  content: JSON.stringify(result)
                });
              } catch (error) {
                const result = { ok: false, error: error instanceof Error ? error.message : "Tool failed." };
                await logToolAction(conversationId, toolUse.name, toolUse.input, result, false);
                send({ type: "tool_done", tool: toolUse.name, result });
                toolResults.push({
                  type: "tool_result",
                  tool_use_id: toolUse.id,
                  content: JSON.stringify(result)
                });
              }
            }

            currentMessages = [...currentMessages, { role: "user", content: toolResults }];
            continue;
          }

          currentMessages = [...currentMessages, { role: "assistant", content: response.content }];
          conversationId = await saveConversation(conversationId, promptContext.businessId, currentMessages, uiMessages[0]?.text);
          send({ type: "conversation", conversationId });
          continueLoop = false;
        }

        send({ type: "done" });
        controller.close();
      } catch (error) {
        send({ type: "error", error: error instanceof Error ? error.message : "Assistant request failed." });
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}
