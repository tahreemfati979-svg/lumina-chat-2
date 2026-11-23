export type Role = 'user' | 'assistant';

export type ThemeMode = 'dark' | 'light';

export interface Message {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
  updatedAt?: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export interface ChatError {
  message: string;
  code?: string;
}
