import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { requireServerEnv } from "@/lib/env";
import { ASSISTANT_TOOLS } from "@/lib/assistant/tools";
import { buildSystemPrompt } from "@/lib/assistant/systemPrompt";
import { executeToolCall, getAssistantPromptContext } from "@/lib/assistant/toolHandlers";
import type {
  AssistantChatRequest,
  AssistantUiMessage,
  OpenAIChatResponse,
  OpenAIMessageParam,
  OpenAIToolCall
} from "@/lib/assistant/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function toOpenAIMessages(messages: AssistantUiMessage[]): OpenAIMessageParam[] {
  return messages.map((message) => ({
    role: message.role,
    content: message.text
  }));
}

function extractUiHistory(messages: OpenAIMessageParam[]): AssistantUiMessage[] {
  return messages
    .filter((message) => (message.role === "user" || message.role === "assistant") && typeof message.content === "string" && message.content.trim())
    .map((message) => ({
      id: randomUUID(),
      role: message.role as "user" | "assistant",
      text: String(message.content),
      createdAt: new Date().toISOString()
    }));
}

function parseToolInput(toolCall: OpenAIToolCall) {
  if (!toolCall.function.arguments) return {};
  try {
    return JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function callOpenAI(messages: OpenAIMessageParam[], system: string) {
  const env = requireServerEnv();
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-4.1",
      temperature: 0.2,
      max_tokens: 1024,
      tool_choice: "auto",
      tools: ASSISTANT_TOOLS,
      messages: [{ role: "system", content: system }, ...messages]
    })
  });

  if (!response.ok) {
    const failure = await response.text();
    throw new Error(`OpenAI request failed: ${failure}`);
  }

  return (await response.json()) as OpenAIChatResponse;
}

async function saveConversation(conversationId: string | null | undefined, businessId: string, messages: OpenAIMessageParam[], firstUserText?: string) {
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

  const { data, error } = await supabase.from("assistant_conversations").insert(payload).select("*").single();
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

  const messages = (data.messages as OpenAIMessageParam[]) ?? [];
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
        let currentMessages = toOpenAIMessages(uiMessages);
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
          const response = await callOpenAI(currentMessages, system);
          const responseMessage = response.choices[0]?.message;
          const assistantText = responseMessage?.content?.trim() ?? "";

          if (assistantText) {
            send({ type: "text", text: assistantText });
          }

          if (responseMessage?.tool_calls?.length) {
            currentMessages = [
              ...currentMessages,
              {
                role: "assistant",
                content: assistantText || null,
                tool_calls: responseMessage.tool_calls
              }
            ];

            conversationId = await saveConversation(conversationId, promptContext.businessId, currentMessages, uiMessages[0]?.text);

            for (const toolCall of responseMessage.tool_calls) {
              const toolName = toolCall.function.name;
              const toolInput = parseToolInput(toolCall);
              send({ type: "tool_start", tool: toolName });

              try {
                const result = await executeToolCall(toolName, toolInput, routeContext);
                await logToolAction(conversationId, toolName, toolInput, result, true);
                send({ type: "tool_done", tool: toolName, result });
                if (result.navigation?.path) {
                  send({ type: "navigation", path: result.navigation.path });
                }
                currentMessages = [...currentMessages, { role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(result) }];
              } catch (error) {
                const result = { ok: false, error: error instanceof Error ? error.message : "Tool failed." };
                await logToolAction(conversationId, toolName, toolInput, result, false);
                send({ type: "tool_done", tool: toolName, result });
                currentMessages = [...currentMessages, { role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(result) }];
              }
            }
            continue;
          }

          currentMessages = [...currentMessages, { role: "assistant", content: assistantText }];
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
