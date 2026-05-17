export type AssistantUiMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
};

export type AssistantToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
};

export type OpenAIToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type OpenAIMessageParam = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  tool_calls?: OpenAIToolCall[];
};

export type OpenAIChatResponse = {
  choices: Array<{
    message: {
      role: "assistant";
      content: string | null;
      tool_calls?: OpenAIToolCall[];
    };
    finish_reason: "stop" | "tool_calls" | "length" | "content_filter" | null;
  }>;
};

export type AssistantRouteContext = {
  pathname: string;
  jobId?: string | null;
  quoteId?: string | null;
};

export type AssistantChatRequest = {
  messages: AssistantUiMessage[];
  conversationId?: string | null;
  context?: AssistantRouteContext;
};

export type ToolExecutionResult = {
  ok: boolean;
  summary?: string;
  navigation?: {
    path: string;
  };
  data?: unknown;
  error?: string;
};

export type AssistantConversationRecord = {
  id: string;
  title: string | null;
  messages: OpenAIMessageParam[];
  history: AssistantUiMessage[];
  updated_at?: string;
};
