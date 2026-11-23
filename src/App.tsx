import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowUp,
  Menu,
  MessageSquarePlus,
  RefreshCw,
  Square,
  X,
} from 'lucide-react';
import { ChatMessage } from './components/ChatMessage';
import { ConfirmModal } from './components/ConfirmModal';
import { EmptyState } from './components/EmptyState';
import { Sidebar } from './components/Sidebar';
import { streamChatCompletion } from './services/chatApi';
import type { ChatError, Conversation, Message, ThemeMode } from './types/chat';
import {
  deriveTitleFromMessage,
  generateId,
  loadActiveConversationId,
  loadConversations,
  loadTheme,
  saveActiveConversationId,
  saveConversations,
  saveTheme,
} from './utils/storage';

type DeleteTarget =
  | { type: 'single'; conversation: Conversation }
  | { type: 'all' }
  | null;

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>(() =>
    loadConversations()
  );
  const [activeId, setActiveId] = useState<string | null>(() => {
    const saved = loadConversations();
    const savedActiveId = loadActiveConversationId();
    if (savedActiveId && saved.some((c) => c.id === savedActiveId)) {
      return savedActiveId;
    }
    return saved[0]?.id ?? null;
  });
  const [theme, setTheme] = useState<ThemeMode>(() => loadTheme());
  const [input, setInput] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<ChatError | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);

  const isSendingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  const activeConversation =
    conversations.find((c) => c.id === activeId) ?? null;

  // Sync theme class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    saveTheme(theme);
  }, [theme]);

  // Persist conversations to Local Storage (debounced during active streaming)
  useEffect(() => {
    const delay = isStreaming ? 500 : 0;
    const timer = window.setTimeout(() => {
      const res = saveConversations(conversations);
      if (!res.ok && res.error) {
        setStorageWarning(res.error);
      } else {
        setStorageWarning(null);
      }
    }, delay);
    return () => window.clearTimeout(timer);
  }, [conversations, isStreaming]);

  // Persist active conversation pointer
  useEffect(() => {
    saveActiveConversationId(activeId);
  }, [activeId]);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages.length, isStreaming]);

  const abortOngoingStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    isSendingRef.current = false;
    setIsStreaming(false);
  }, []);

  const resizeComposer = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  };

  const runCompletion = useCallback(
    async (
      conversationId: string,
      historyForApi: Message[],
      assistantMessageId: string
    ) => {
      if (isSendingRef.current) return;
      isSendingRef.current = true;
      setIsStreaming(true);
      setError(null);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      let receivedAnyToken = false;

      try {
        const apiMessages = historyForApi
          .filter((m) => m.content.trim().length > 0)
          .map((m) => ({ role: m.role, content: m.content }));

        await streamChatCompletion(
          apiMessages,
          (chunkText) => {
            receivedAnyToken = true;
            setConversations((prev) =>
              prev.map((conv) => {
                if (conv.id !== conversationId) return conv;
                return {
                  ...conv,
                  updatedAt: Date.now(),
                  messages: conv.messages.map((msg) =>
                    msg.id === assistantMessageId
                      ? { ...msg, content: msg.content + chunkText }
                      : msg
                  ),
                };
              })
            );
          },
          controller.signal
        );

        // If stream completed with 0 tokens (edge case), remove empty placeholder
        if (!receivedAnyToken) {
          setConversations((prev) =>
            prev.map((conv) =>
              conv.id === conversationId
                ? {
                    ...conv,
                    messages: conv.messages.filter(
                      (m) => m.id !== assistantMessageId
                    ),
                  }
                : conv
            )
          );
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          if (!receivedAnyToken) {
            setConversations((prev) =>
              prev.map((conv) =>
                conv.id === conversationId
                  ? {
                      ...conv,
                      messages: conv.messages.filter(
                        (m) => m.id !== assistantMessageId
                      ),
                    }
                  : conv
              )
            );
          }
          return;
        }

        if (!receivedAnyToken) {
          setConversations((prev) =>
            prev.map((conv) =>
              conv.id === conversationId
                ? {
                    ...conv,
                    messages: conv.messages.filter(
                      (m) => m.id !== assistantMessageId
                    ),
                  }
                : conv
            )
          );
        }

        setError({
          message:
            err instanceof Error
              ? err.message
              : 'Unable to get a response. Please try again.',
        });
      } finally {
        abortControllerRef.current = null;
        isSendingRef.current = false;
        setIsStreaming(false);
      }
    },
    []
  );

  const handleSendMessage = useCallback(
    async (overrideText?: string) => {
      const textToSend = (overrideText ?? input).trim();
      if (!textToSend || isSendingRef.current) return;

      const now = Date.now();
      const userMessage: Message = {
        id: generateId(),
        role: 'user',
        content: textToSend,
        createdAt: now,
      };
      const assistantPlaceholder: Message = {
        id: generateId(),
        role: 'assistant',
        content: '',
        createdAt: now + 1,
      };

      if (!overrideText) {
        setInput('');
        if (composerRef.current) {
          composerRef.current.style.height = 'auto';
        }
      }

      let targetConversationId = activeId;
      let historyForApi: Message[] = [];

      if (
        !targetConversationId ||
        !conversations.some((c) => c.id === targetConversationId)
      ) {
        targetConversationId = generateId();
        const newConv: Conversation = {
          id: targetConversationId,
          title: deriveTitleFromMessage(textToSend),
          messages: [userMessage, assistantPlaceholder],
          createdAt: now,
          updatedAt: now,
        };
        historyForApi = [userMessage];
        setConversations((prev) => [newConv, ...prev]);
        setActiveId(targetConversationId);
      } else {
        const existing = conversations.find((c) => c.id === targetConversationId)!;
        historyForApi = [...existing.messages, userMessage];
        const nextTitle =
          existing.messages.length === 0 && existing.title === 'New Chat'
            ? deriveTitleFromMessage(textToSend)
            : existing.title;

        setConversations((prev) => {
          const updated = prev.map((conv) => {
            if (conv.id !== targetConversationId) return conv;
            return {
              ...conv,
              title: nextTitle,
              updatedAt: now,
              messages: [...conv.messages, userMessage, assistantPlaceholder],
            };
          });
          return [...updated].sort((a, b) => b.updatedAt - a.updatedAt);
        });
      }

      await runCompletion(
        targetConversationId,
        historyForApi,
        assistantPlaceholder.id
      );
    },
    [activeId, conversations, input, runCompletion]
  );

  const handleNewChat = useCallback(() => {
    abortOngoingStream();
    setError(null);

    const existingEmpty = conversations.find((c) => c.messages.length === 0);
    if (existingEmpty) {
      setActiveId(existingEmpty.id);
      composerRef.current?.focus();
      return;
    }

    const now = Date.now();
    const newChat: Conversation = {
      id: generateId(),
      title: 'New Chat',
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    setConversations((prev) => [newChat, ...prev]);
    setActiveId(newChat.id);
    window.setTimeout(() => composerRef.current?.focus(), 0);
  }, [abortOngoingStream, conversations]);

  const handleSelectChat = useCallback(
    (id: string) => {
      if (id === activeId) return;
      abortOngoingStream();
      setError(null);
      setActiveId(id);
    },
    [abortOngoingStream, activeId]
  );

  const handleRenameChat = useCallback((id: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === id
          ? { ...conv, title: trimmed, updatedAt: Date.now() }
          : conv
      )
    );
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    abortOngoingStream();
    setError(null);

    if (deleteTarget.type === 'all') {
      setConversations([]);
      setActiveId(null);
      setDeleteTarget(null);
      return;
    }

    const targetId = deleteTarget.conversation.id;
    setConversations((prev) => {
      const remaining = prev.filter((c) => c.id !== targetId);
      if (activeId === targetId) {
        setActiveId(remaining[0]?.id ?? null);
      }
      return remaining;
    });
    setDeleteTarget(null);
  }, [abortOngoingStream, activeId, deleteTarget]);

  const handleEditMessage = useCallback(
    async (messageId: string, newContent: string, regenerate: boolean) => {
      if (!activeConversation || isSendingRef.current) return;
      const msgIndex = activeConversation.messages.findIndex(
        (m) => m.id === messageId
      );
      if (msgIndex === -1) return;

      const now = Date.now();
      const targetMsg = activeConversation.messages[msgIndex];

      if (!regenerate || targetMsg.role !== 'user') {
        setConversations((prev) =>
          prev.map((conv) => {
            if (conv.id !== activeConversation.id) return conv;
            return {
              ...conv,
              updatedAt: now,
              messages: conv.messages.map((m) =>
                m.id === messageId
                  ? { ...m, content: newContent, updatedAt: now }
                  : m
              ),
            };
          })
        );
        return;
      }

      const updatedUserMsg: Message = {
        ...targetMsg,
        content: newContent,
        updatedAt: now,
      };
      const truncatedHistory = [
        ...activeConversation.messages.slice(0, msgIndex),
        updatedUserMsg,
      ];
      const assistantPlaceholder: Message = {
        id: generateId(),
        role: 'assistant',
        content: '',
        createdAt: now + 1,
      };

      setConversations((prev) =>
        prev.map((conv) => {
          if (conv.id !== activeConversation.id) return conv;
          return {
            ...conv,
            updatedAt: now,
            messages: [...truncatedHistory, assistantPlaceholder],
          };
        })
      );

      await runCompletion(
        activeConversation.id,
        truncatedHistory,
        assistantPlaceholder.id
      );
    },
    [activeConversation, runCompletion]
  );

  const handleDeleteMessage = useCallback(
    (messageId: string) => {
      if (!activeConversation || isSendingRef.current) return;
      setConversations((prev) =>
        prev.map((conv) => {
          if (conv.id !== activeConversation.id) return conv;
          return {
            ...conv,
            updatedAt: Date.now(),
            messages: conv.messages.filter((m) => m.id !== messageId),
          };
        })
      );
    },
    [activeConversation]
  );

  const handleRegenerate = useCallback(async () => {
    if (!activeConversation || isSendingRef.current) return;

    const msgs = activeConversation.messages;
    let lastUserIdx = -1;
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === 'user') {
        lastUserIdx = i;
        break;
      }
    }
    if (lastUserIdx === -1) return;

    const historyUpToLastUser = msgs.slice(0, lastUserIdx + 1);
    const now = Date.now();
    const assistantPlaceholder: Message = {
      id: generateId(),
      role: 'assistant',
      content: '',
      createdAt: now,
    };

    setConversations((prev) =>
      prev.map((conv) => {
        if (conv.id !== activeConversation.id) return conv;
        return {
          ...conv,
          updatedAt: now,
          messages: [...historyUpToLastUser, assistantPlaceholder],
        };
      })
    );

    await runCompletion(
      activeConversation.id,
      historyUpToLastUser,
      assistantPlaceholder.id
    );
  }, [activeConversation, runCompletion]);

  const handleRetryError = useCallback(() => {
    setError(null);
    handleRegenerate();
  }, [handleRegenerate]);

  const lastAssistantId = (() => {
    if (!activeConversation) return null;
    for (let i = activeConversation.messages.length - 1; i >= 0; i--) {
      if (activeConversation.messages[i].role === 'assistant') {
        return activeConversation.messages[i].id;
      }
    }
    return null;
  })();

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-slate-50 text-slate-900 dark:bg-[#0B0F17] dark:text-slate-100">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        isOpen={isSidebarOpen}
        theme={theme}
        onClose={() => setIsSidebarOpen(false)}
        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
        onRenameChat={handleRenameChat}
        onRequestDeleteChat={(conv) =>
          setDeleteTarget({ type: 'single', conversation: conv })
        }
        onRequestClearAll={() => setDeleteTarget({ type: 'all' })}
        onToggleTheme={() =>
          setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
        }
      />

      <main className="flex min-w-0 flex-1 flex-col">
        {/* Top Header */}
        <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white/80 px-4 backdrop-blur-xs dark:border-slate-800/90 dark:bg-[#0B0F17]/90">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 md:hidden dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              aria-label="Open chat history"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="min-w-0">
              <h2 className="truncate font-display text-sm font-semibold text-slate-900 sm:text-base dark:text-white">
                {activeConversation ? activeConversation.title : 'Lumina Chat'}
              </h2>
            </div>

            {activeConversation && activeConversation.messages.length > 0 && (
              <div className="hidden items-center gap-1.5 text-xs text-slate-400 tabular-nums sm:flex dark:text-slate-500">
                <span aria-hidden="true">·</span>
                <span className="whitespace-nowrap">
                  {activeConversation.messages.length}{' '}
                  {activeConversation.messages.length === 1
                    ? 'message'
                    : 'messages'}
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleNewChat}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 md:hidden dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            aria-label="Start new chat"
            title="New chat"
          >
            <MessageSquarePlus className="h-5 w-5" />
          </button>
        </header>

        {/* Storage quota warning if applicable */}
        {storageWarning && (
          <div
            role="status"
            className="flex items-center justify-between gap-3 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-800 dark:text-amber-300"
          >
            <span>{storageWarning}</span>
            <button
              type="button"
              onClick={() => setStorageWarning(null)}
              className="rounded p-1 hover:bg-amber-500/20"
              aria-label="Dismiss warning"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Chat Messages Area */}
        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
          {!activeConversation || activeConversation.messages.length === 0 ? (
            <EmptyState onSelectPrompt={(prompt) => handleSendMessage(prompt)} />
          ) : (
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
              {activeConversation.messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  isLatestAssistant={message.id === lastAssistantId}
                  isStreaming={isStreaming}
                  onEdit={handleEditMessage}
                  onDelete={handleDeleteMessage}
                  onRegenerate={handleRegenerate}
                />
              ))}

              {error && (
                <div
                  role="alert"
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300"
                >
                  <div className="flex items-center gap-2.5">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{error.message}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleRetryError}
                      className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700 whitespace-nowrap shrink-0"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>Retry</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setError(null)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-red-600 hover:bg-red-500/15 dark:text-red-300"
                      aria-label="Dismiss error"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Message Composer */}
        <div className="shrink-0 border-t border-slate-200 bg-white/90 px-4 py-3 backdrop-blur-xs sm:px-6 sm:py-4 dark:border-slate-800/90 dark:bg-[#0B0F17]/95">
          <div className="mx-auto w-full max-w-3xl">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 transition-colors focus-within:border-blue-500 focus-within:bg-white dark:border-slate-800 dark:bg-[#131A26] dark:focus-within:border-blue-500"
            >
              <textarea
                ref={composerRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  resizeComposer(e.target);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Message Lumina..."
                rows={1}
                aria-label="Message input"
                className="max-h-[180px] min-h-[42px] flex-1 resize-none bg-transparent px-2.5 py-2 text-[15px] leading-relaxed text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
              />

              {isStreaming ? (
                <button
                  type="button"
                  onClick={abortOngoingStream}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-white transition-colors hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-slate-700 dark:hover:bg-slate-600"
                  aria-label="Stop generating"
                  title="Stop generating"
                >
                  <Square className="h-4 w-4 fill-current" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:disabled:bg-slate-800 dark:disabled:text-slate-600"
                  aria-label="Send message"
                  title="Send message"
                >
                  <ArrowUp className="h-5 w-5" />
                </button>
              )}
            </form>

            <div className="mt-2 hidden items-center justify-between px-1 text-xs text-slate-400 sm:flex dark:text-slate-500">
              <span>Press Enter to send · Shift + Enter for new line</span>
              <span>Saved locally in your browser</span>
            </div>
          </div>
        </div>
      </main>

      <ConfirmModal
        isOpen={deleteTarget !== null}
        title={
          deleteTarget?.type === 'all'
            ? 'Clear all conversations?'
            : 'Delete conversation?'
        }
        description={
          deleteTarget?.type === 'all'
            ? 'This will permanently remove all saved chat history from your browser. This action cannot be undone.'
            : deleteTarget?.type === 'single'
            ? `Are you sure you want to delete "${deleteTarget.conversation.title}"? This action cannot be undone.`
            : ''
        }
        confirmLabel={deleteTarget?.type === 'all' ? 'Clear All' : 'Delete'}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
