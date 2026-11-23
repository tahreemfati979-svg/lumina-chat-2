import type { Conversation, Message, ThemeMode } from '../types/chat';

const CONVERSATIONS_KEY = 'lumina_chat_conversations_v1';
const ACTIVE_CHAT_KEY = 'lumina_chat_active_id_v1';
const THEME_KEY = 'lumina_chat_theme_v1';

export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function deriveTitleFromMessage(content: string): string {
  const cleaned = content.replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'New Chat';
  if (cleaned.length <= 42) return cleaned;
  return `${cleaned.slice(0, 42).trimEnd()}...`;
}

export function deduplicateMessages(messages: Message[]): Message[] {
  const seen = new Set<string>();
  const result: Message[] = [];
  for (const msg of messages) {
    if (!msg || typeof msg.id !== 'string' || seen.has(msg.id)) continue;
    if (msg.role !== 'user' && msg.role !== 'assistant') continue;
    if (typeof msg.content !== 'string') continue;
    seen.add(msg.id);
    result.push({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      createdAt: typeof msg.createdAt === 'number' ? msg.createdAt : Date.now(),
      updatedAt: typeof msg.updatedAt === 'number' ? msg.updatedAt : undefined,
    });
  }
  return result;
}

export function loadConversations(): Conversation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CONVERSATIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const seenIds = new Set<string>();
    const valid: Conversation[] = [];

    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      if (typeof item.id !== 'string' || seenIds.has(item.id)) continue;
      seenIds.add(item.id);
      valid.push({
        id: item.id,
        title: typeof item.title === 'string' && item.title.trim() ? item.title.trim() : 'New Chat',
        messages: Array.isArray(item.messages) ? deduplicateMessages(item.messages) : [],
        createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
        updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : Date.now(),
      });
    }

    return valid.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export function saveConversations(conversations: Conversation[]): { ok: boolean; error?: string } {
  if (typeof window === 'undefined') return { ok: true };
  try {
    window.localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
    return { ok: true };
  } catch (err) {
    const message =
      err instanceof DOMException && err.name === 'QuotaExceededError'
        ? 'Browser storage is full. Consider deleting older conversations.'
        : 'Unable to save conversations to browser storage.';
    return { ok: false, error: message };
  }
}

export function loadActiveConversationId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(ACTIVE_CHAT_KEY);
  } catch {
    return null;
  }
}

export function saveActiveConversationId(id: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (id) {
      window.localStorage.setItem(ACTIVE_CHAT_KEY, id);
    } else {
      window.localStorage.removeItem(ACTIVE_CHAT_KEY);
    }
  } catch {
    // Ignore storage write failure for active pointer
  }
}

export function loadTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  try {
    const saved = window.localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
  } catch {
    // Ignore storage read error
  }
  return 'dark';
}

export function saveTheme(theme: ThemeMode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Ignore storage write error
  }
}

export function formatTime(timestamp: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(timestamp));
  } catch {
    return '';
  }
}

export function formatRelativeDate(timestamp: number): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const isSameDay =
    now.getFullYear() === date.getFullYear() &&
    now.getMonth() === date.getMonth() &&
    now.getDate() === date.getDate();

  if (isSameDay) {
    return formatTime(timestamp);
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    yesterday.getFullYear() === date.getFullYear() &&
    yesterday.getMonth() === date.getMonth() &&
    yesterday.getDate() === date.getDate();

  if (isYesterday) return 'Yesterday';

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(date);
}
