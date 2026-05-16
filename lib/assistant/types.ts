export type AssistantUiMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
};

export type AssistantToolDefinition = {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
};

export type AnthropicTextBlock = {
  type: "text";
  text: string;
};

export type AnthropicToolUseBlock = {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
};

export type AnthropicToolResultBlock = {
  type: "tool_result";
  tool_use_id: string;
  content: string;
};

export type AnthropicContentBlock = AnthropicTextBlock | AnthropicToolUseBlock | AnthropicToolResultBlock;

export type AnthropicMessageParam = {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
};

export type AnthropicMessageResponse = {
  id: string;
  content: AnthropicContentBlock[];
  stop_reason: "end_turn" | "tool_use" | "max_tokens" | "stop_sequence" | null;
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
  messages: AnthropicMessageParam[];
  history: AssistantUiMessage[];
  updated_at?: string;
};
