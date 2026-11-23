import React, { useEffect, useRef, useState } from 'react';
import {
  Bot,
  Check,
  Copy,
  Pencil,
  RotateCcw,
  Trash2,
  User,
  X,
} from 'lucide-react';
import type { Message } from '../types/chat';
import { formatTime } from '../utils/storage';
import { MarkdownRenderer } from './MarkdownRenderer';

interface ChatMessageProps {
  message: Message;
  isLatestAssistant: boolean;
  isStreaming: boolean;
  onEdit: (messageId: string, newContent: string, regenerate: boolean) => void;
  onDelete: (messageId: string) => void;
  onRegenerate: () => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  isLatestAssistant,
  isStreaming,
  onEdit,
  onDelete,
  onRegenerate,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const isUser = message.role === 'user';
  const isWaitingForFirstToken =
    !isUser && isStreaming && isLatestAssistant && message.content.length === 0;

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [isEditing]);

  const handleCopy = async () => {
    if (!message.content) return;
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API unavailable
    }
  };

  const handleStartEdit = () => {
    setDraft(message.content);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setDraft(message.content);
    setIsEditing(false);
  };

  const handleSaveEdit = (regenerate: boolean) => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setIsEditing(false);
    onEdit(message.id, trimmed, regenerate);
  };

  return (
    <div
      className={`group flex w-full gap-3 ${
        isUser ? 'justify-end' : 'justify-start'
      }`}
    >
      {!isUser && (
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-blue-600 dark:border-slate-800 dark:bg-[#161E2E] dark:text-blue-400">
          <Bot className="h-4 w-4" />
        </div>
      )}

      <div
        className={`flex max-w-[88%] flex-col sm:max-w-[78%] ${
          isUser ? 'items-end' : 'items-start'
        }`}
      >
        <div
          className={`w-full rounded-2xl px-4 py-3 ${
            isUser
              ? 'bg-blue-600 text-white'
              : 'border border-slate-200 bg-white text-slate-800 dark:border-slate-800 dark:bg-[#131A26] dark:text-slate-100'
          }`}
        >
          {isEditing ? (
            <div className="space-y-3 min-w-[240px] sm:min-w-[340px]">
              <textarea
                ref={textareaRef}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 260)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    handleCancelEdit();
                  } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleSaveEdit(isUser);
                  }
                }}
                rows={2}
                aria-label="Edit message"
                className={`w-full resize-none rounded-lg border p-2.5 text-[15px] leading-relaxed focus:outline-none ${
                  isUser
                    ? 'border-blue-400/50 bg-blue-700/60 text-white placeholder:text-blue-200 focus:border-white'
                    : 'border-slate-300 bg-slate-50 text-slate-900 focus:border-blue-500 dark:border-slate-700 dark:bg-[#0B0F17] dark:text-slate-100'
                }`}
              />
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className={`inline-flex min-h-[34px] items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    isUser
                      ? 'bg-blue-700/70 text-blue-100 hover:bg-blue-800'
                      : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <X className="h-3.5 w-3.5" />
                  <span>Cancel</span>
                </button>
                {isUser && (
                  <button
                    type="button"
                    onClick={() => handleSaveEdit(false)}
                    disabled={!draft.trim()}
                    className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-blue-800/70 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-900 disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>Save</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleSaveEdit(isUser)}
                  disabled={!draft.trim()}
                  className={`inline-flex min-h-[34px] items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 ${
                    isUser
                      ? 'bg-white text-blue-700 hover:bg-blue-50'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>{isUser ? 'Save & Regenerate' : 'Save'}</span>
                </button>
              </div>
            </div>
          ) : isWaitingForFirstToken ? (
            <div className="flex items-center gap-2 py-1 text-sm text-slate-500 dark:text-slate-400">
              <span className="inline-flex gap-1" aria-hidden="true">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
              </span>
              <span>Thinking...</span>
            </div>
          ) : isUser ? (
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed break-words">
              {message.content}
            </p>
          ) : (
            <MarkdownRenderer content={message.content} />
          )}
        </div>

        {/* Timestamp & message actions */}
        {!isEditing && !isWaitingForFirstToken && (
          <div
            className={`mt-1.5 flex items-center gap-2 px-1 text-xs text-slate-400 dark:text-slate-500 ${
              isUser ? 'flex-row-reverse' : 'flex-row'
            }`}
          >
            <span className="tabular-nums">{formatTime(message.createdAt)}</span>
            {message.updatedAt && (
              <>
                <span aria-hidden="true">·</span>
                <span>Edited</span>
              </>
            )}

            <div className="flex items-center gap-0.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
              <button
                type="button"
                onClick={handleCopy}
                className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-200/70 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label="Copy message"
                title="Copy message"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>

              {!isStreaming && (
                <>
                  <button
                    type="button"
                    onClick={handleStartEdit}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-200/70 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    aria-label="Edit message"
                    title="Edit message"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>

                  {!isUser && isLatestAssistant && (
                    <button
                      type="button"
                      onClick={onRegenerate}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-200/70 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                      aria-label="Regenerate response"
                      title="Regenerate response"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onDelete(message.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:hover:bg-red-500/15 dark:hover:text-red-400"
                    aria-label="Delete message"
                    title="Delete message"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {isUser && (
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300">
          <User className="h-4 w-4" />
        </div>
      )}
    </div>
  );
};
