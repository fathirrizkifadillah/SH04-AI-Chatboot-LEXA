// Frontend Widget API Types

export interface WidgetConfig {
  welcome_message: string;
  quick_replies: string[];
  bot_name?: string;
  bot_avatar?: string;
}

export interface ChatRequest {
  message: string;
  session_id?: string;
}

export interface ChatReference {
  title: string;
  source: string;
  score: number;
  content?: string;
}

export interface ChatResponse {
  reply: string;
  session_id: string;
  references: ChatReference[];
}

export interface SSESessionEvent {
  type: 'session';
  session_id: string;
}

export interface SSEChunkEvent {
  type: 'chunk';
  content: string;
}

export interface SSEDoneEvent {
  type: 'done';
  references: Omit<ChatReference, 'content'>[];
}

export interface SSEErrorEvent {
  type: 'error';
  message: string;
}

export type SSEEvent = SSESessionEvent | SSEChunkEvent | SSEDoneEvent | SSEErrorEvent;

export interface Message {
  role: 'user' | 'bot' | 'admin';
  content: string;
  timestamp: number;
  id: number;
}