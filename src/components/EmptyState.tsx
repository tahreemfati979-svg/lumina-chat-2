import React from 'react';
import { Code2, Compass, FileText, Lightbulb, MessageSquare } from 'lucide-react';

interface EmptyStateProps {
  onSelectPrompt: (prompt: string) => void;
}

const STARTER_PROMPTS = [
  {
    icon: Lightbulb,
    title: 'Explain a concept clearly',
    prompt: 'Explain how browser Local Storage works and when to use it versus IndexedDB.',
  },
  {
    icon: Code2,
    title: 'Debug or write TypeScript',
    prompt: 'Write a clean TypeScript debounce hook for React with proper cleanup.',
  },
  {
    icon: FileText,
    title: 'Draft and polish writing',
    prompt: 'Help me write a concise, friendly release note for a new dark mode feature.',
  },
  {
    icon: Compass,
    title: 'Plan a structured workflow',
    prompt: 'Create a practical 5-step checklist for launching a fast, accessible web app.',
  },
];

export const EmptyState: React.FC<EmptyStateProps> = ({ onSelectPrompt }) => {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center justify-center px-4 py-10 text-center sm:py-16">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white text-blue-600 dark:border-slate-800 dark:bg-[#131A26] dark:text-blue-400">
        <MessageSquare className="h-6 w-6" />
      </div>

      <h1 className="mt-5 font-display text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
        How can I help you today?
      </h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-500 dark:text-slate-400">
        Ask a question, brainstorm ideas, or paste code. Your conversations stay saved right in your browser.
      </p>

      <div className="mt-8 grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
        {STARTER_PROMPTS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.title}
              type="button"
              onClick={() => onSelectPrompt(item.prompt)}
              className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-blue-500/50 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-800 dark:bg-[#131A26] dark:hover:border-blue-500/50 dark:hover:bg-[#172030]"
            >
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {item.title}
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {item.prompt}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
