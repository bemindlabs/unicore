'use client';

import { useState, useRef, useEffect, KeyboardEvent, useCallback } from 'react';
import { cn } from '@/lib/utils';

const AGENT_NAMES = [
  'architect',
  'coder',
  'reviewer',
  'tester',
  'devops',
  'analyst',
  'documenter',
  'planner',
  'debugger',
];

const COMMANDS = [
  'help',
  'clear',
  'status',
  'list agents',
  'list tasks',
  'run',
  'stop',
  'restart',
  'logs',
  'deploy',
  'build',
  'test',
  'lint',
  'format',
  'config',
  'exit',
  '/erp contacts',
  '/erp orders',
  '/erp inventory',
  '/erp revenue',
  '/erp invoice',
  '/erp report pnl',
];

const ALL_SUGGESTIONS = [...COMMANDS, ...AGENT_NAMES.map((a) => `agent ${a}`)];

const HISTORY_KEY = 'unicore:terminal:history';
const MAX_HISTORY = 100;

function loadHistory(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveHistory(history: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-MAX_HISTORY)));
  } catch {
    // ignore storage errors
  }
}

interface CommandInputProps {
  onSubmit?: (command: string) => void;
  onCancel?: () => void;
  disabled?: boolean;
  className?: string;
}

export function CommandInput({ onSubmit, onCancel, disabled, className }: CommandInputProps) {
  const [value, setValue] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionIndex, setSuggestionIndex] = useState(-1);
  const [history, setHistory] = useState<string[]>(() => loadHistory());
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [savedInput, setSavedInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  const computeSuggestions = useCallback((input: string): string[] => {
    const lastLine = input.split('\n').pop() ?? '';
    const trimmed = lastLine.trimStart();
    if (!trimmed) return [];
    return ALL_SUGGESTIONS.filter((s) =>
      s.toLowerCase().startsWith(trimmed.toLowerCase())
    ).slice(0, 8);
  }, []);

  const handleChange = (val: string) => {
    setValue(val);
    setHistoryIndex(-1);
    const newSuggestions = computeSuggestions(val);
    setSuggestions(newSuggestions);
    setSuggestionIndex(-1);
  };

  const applySuggestion = (suggestion: string) => {
    const lines = value.split('\n');
    const lastLine = lines[lines.length - 1];
    const trimmed = lastLine.trimStart();
    const leadingSpace = lastLine.slice(0, lastLine.length - trimmed.length);
    lines[lines.length - 1] = leadingSpace + suggestion;
    const newValue = lines.join('\n');
    setValue(newValue);
    setSuggestions([]);
    setSuggestionIndex(-1);
    textareaRef.current?.focus();
  };

  const submitCommand = (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    const newHistory = [...history, trimmed].slice(-MAX_HISTORY);
    setHistory(newHistory);
    saveHistory(newHistory);
    setHistoryIndex(-1);
    setSavedInput('');
    setValue('');
    setSuggestions([]);
    setSuggestionIndex(-1);
    onSubmit?.(trimmed);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Tab autocomplete
    if (e.key === 'Tab') {
      e.preventDefault();
      if (suggestions.length === 0) return;
      if (suggestions.length === 1) {
        applySuggestion(suggestions[0]);
        return;
      }
      const next = (suggestionIndex + 1) % suggestions.length;
      setSuggestionIndex(next);
      return;
    }

    // Apply highlighted suggestion with Enter when dropdown is open
    if (e.key === 'Enter' && suggestions.length > 0 && suggestionIndex >= 0) {
      e.preventDefault();
      applySuggestion(suggestions[suggestionIndex]);
      return;
    }

    // Shift+Enter → newline
    if (e.key === 'Enter' && e.shiftKey) {
      return; // allow default (inserts newline)
    }

    // Enter → submit
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitCommand(value);
      return;
    }

    // Ctrl+C → cancel
    if (e.key === 'c' && e.ctrlKey) {
      e.preventDefault();
      setValue('');
      setSuggestions([]);
      setSuggestionIndex(-1);
      setHistoryIndex(-1);
      onCancel?.();
      return;
    }

    // Escape → close suggestions
    if (e.key === 'Escape') {
      setSuggestions([]);
      setSuggestionIndex(-1);
      return;
    }

    // Arrow Up → history navigation / suggestion navigation
    if (e.key === 'ArrowUp') {
      if (suggestions.length > 0) {
        e.preventDefault();
        const prev = suggestionIndex <= 0 ? suggestions.length - 1 : suggestionIndex - 1;
        setSuggestionIndex(prev);
        return;
      }
      e.preventDefault();
      if (history.length === 0) return;
      const newIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
      if (historyIndex === -1) setSavedInput(value);
      setHistoryIndex(newIndex);
      setValue(history[newIndex]);
      setSuggestions([]);
      return;
    }

    // Arrow Down → history navigation / suggestion navigation
    if (e.key === 'ArrowDown') {
      if (suggestions.length > 0) {
        e.preventDefault();
        const next = (suggestionIndex + 1) % suggestions.length;
        setSuggestionIndex(next);
        return;
      }
      e.preventDefault();
      if (historyIndex === -1) return;
      if (historyIndex === history.length - 1) {
        setHistoryIndex(-1);
        setValue(savedInput);
        return;
      }
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setValue(history[newIndex]);
      setSuggestions([]);
      return;
    }
  };

  return (
    <div className={cn('relative font-mono text-sm', className)}>
      <div className="flex items-start gap-1">
        <span className="select-none pt-[3px] text-green-400 shrink-0">unicore&gt;</span>
        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            value={value}
            disabled={disabled}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            className={cn(
              'w-full resize-none overflow-hidden bg-transparent text-foreground',
              'outline-none focus:outline-none placeholder:text-muted-foreground',
              'leading-6 py-0 px-0 border-0',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
            placeholder="Type a command… (Tab to autocomplete, ↑↓ history, Shift+Enter for newline)"
          />

          {/* Autocomplete dropdown */}
          {suggestions.length > 0 && (
            <div
              ref={suggestionsRef}
              className="absolute left-0 top-full z-50 mt-1 min-w-[200px] overflow-hidden rounded-md border border-border bg-popover shadow-md"
            >
              {suggestions.map((s, i) => (
                <button
                  key={s}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    applySuggestion(s);
                  }}
                  className={cn(
                    'w-full px-3 py-1.5 text-left text-sm font-mono',
                    'hover:bg-accent hover:text-accent-foreground',
                    i === suggestionIndex && 'bg-accent text-accent-foreground'
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
