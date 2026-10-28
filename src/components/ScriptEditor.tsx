import React, { useState } from 'react';
import {
  ClipboardPaste,
  FileText,
  Sparkles,
  Play,
  Minus,
  Plus,
  Upload,
  Video,
} from 'lucide-react';
import {
  ScriptDocument,
  ScriptStats,
  TeleprompterSettings,
} from '../types/teleprompter';
import { STARTER_SCRIPTS } from '../data/defaultScripts';
import { formatDurationReadable } from '../utils/scriptMetrics';
import { FlowPromptLogo } from './FlowPromptLogo';

interface ScriptEditorProps {
  content: string;
  onChange: (value: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  settings: TeleprompterSettings;
  onUpdateSettings: (partial: Partial<TeleprompterSettings>) => void;
  stats: ScriptStats;
  onSelectTemplate: (template: ScriptDocument) => void;
  onPasteFromClipboard: () => void;
  onImportFile: (file: File) => void;
  onStartTeleprompter: () => void;
  onOpenStudio?: () => void;
}

export const ScriptEditor: React.FC<ScriptEditorProps> = ({
  content,
  onChange,
  textareaRef,
  settings,
  onUpdateSettings,
  stats,
  onSelectTemplate,
  onPasteFromClipboard,
  onImportFile,
  onStartTeleprompter,
  onOpenStudio,
}) => {
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const dragCounterRef = React.useRef(0);
  const emptyFileInputRef = React.useRef<HTMLInputElement>(null);

  const isEmpty = content.trim().length === 0;

  // Extract section headings (# Heading) for quick outline navigation
  const headings = React.useMemo(() => {
    const lines = content.split('\n');
    const result: { title: string; lineIndex: number }[] = [];
    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('#')) {
        result.push({
          title: trimmed.replace(/^#+\s*/, '') || 'Section',
          lineIndex: idx,
        });
      }
    });
    return result;
  }, [content]);

  const scrollToHeading = (headingTitle: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const index = content.indexOf(`# ${headingTitle}`);
    if (index !== -1) {
      textarea.focus();
      textarea.setSelectionRange(index, index);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current += 1;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDraggingFile(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('Files') && !isDraggingFile) {
      setIsDraggingFile(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) {
      setIsDraggingFile(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      onImportFile(file);
    }
  };

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const nextContent = content.substring(0, start) + '  ' + content.substring(end);
      onChange(nextContent);
      window.requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      });
    }
  };

  return (
    <main
      id="workspace"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="flex-1 flex flex-col max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8"
    >
      {/* Empty State Invitation Banner when canvas is blank */}
      {isEmpty && (
        <section
          aria-label="Get started with a script"
          className="mb-6 p-6 sm:p-8 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] shadow-2xs"
        >
          <div className="max-w-2xl">
            <div className="flex items-center gap-3 mb-3">
              <FlowPromptLogo variant="app-icon" size={36} />
              <span className="text-xs font-semibold text-[#FF6A00] dark:text-[#FF8A32]">
                Ready for your script
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)] mb-2 text-balance">
              Write, paste, or import a script to begin prompting.
            </h1>
            <p className="text-sm text-[var(--text-muted)] leading-relaxed mb-5">
              Type directly into the workspace below, drop a{' '}
              <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--text-primary)] border border-[var(--border-subtle)]">
                .txt
              </code>{' '}
              file anywhere, or add{' '}
              <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--text-primary)] border border-[var(--border-subtle)]">
                [PAUSE 2s]
              </code>{' '}
              cues for natural delivery.
            </p>

            <div className="flex flex-wrap items-center gap-2.5 mb-6">
              <button
                type="button"
                onClick={onPasteFromClipboard}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-[#FF6A00] text-white hover:bg-[#E65F00] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6A00]"
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                <span>Paste from Clipboard</span>
              </button>

              <input
                ref={emptyFileInputRef}
                type="file"
                accept=".txt,.md,text/plain,text/markdown"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onImportFile(file);
                  e.target.value = '';
                }}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => emptyFileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-[var(--bg-subtle)] border border-[var(--border-strong)] text-[var(--text-primary)] hover:bg-[var(--bg-control)] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6A00]"
              >
                <Upload className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                <span>Import .txt File</span>
              </button>

              <button
                type="button"
                onClick={() => textareaRef.current?.focus()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-[var(--bg-subtle)] border border-[var(--border-strong)] text-[var(--text-primary)] hover:bg-[var(--bg-control)] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6A00]"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#FF6A00] dark:text-[#FF8A32]" />
                <span>Start Typing Blank</span>
              </button>

              {onOpenStudio && (
                <button
                  type="button"
                  onClick={onOpenStudio}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-[var(--bg-subtle)] border border-[#FF6A00]/40 text-[#FF6A00] dark:text-[#FF8A32] hover:bg-[#FF6A00]/10 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6A00]"
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>Open Record Studio</span>
                </button>
              )}
            </div>

            <div className="pt-5 border-t border-[var(--border-subtle)]">
              <p className="text-xs font-medium text-[var(--text-muted)] mb-3">
                Or load a starter script template:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {STARTER_SCRIPTS.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => onSelectTemplate(tpl)}
                    className="flex items-start gap-3 p-3 rounded-xl border border-[var(--border-subtle)] hover:border-[#FF6A00]/60 bg-[var(--bg-subtle)]/60 text-left group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6A00]"
                  >
                    <FileText className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[#FF6A00] dark:group-hover:text-[#FF8A32] mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[var(--text-primary)] truncate">
                        {tpl.title}
                      </div>
                      <div className="text-xs text-[var(--text-muted)] mt-0.5">
                        {tpl.category}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Main Writing Sheet */}
      <div
        className={`flex-1 flex flex-col rounded-2xl bg-[var(--bg-elevated)] border shadow-2xs overflow-hidden ${
          isDraggingFile
            ? 'border-[#FF6A00] ring-2 ring-[#FF6A00]/20'
            : 'border-[var(--border-subtle)]'
        }`}
      >
        {/* Section Outline Bar (when script has headings) */}
        {headings.length > 0 && (
          <div className="flex items-center gap-2 px-5 py-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)]/50 overflow-x-auto no-scrollbar">
            <span className="text-xs font-medium text-[var(--text-muted)] whitespace-nowrap shrink-0">
              Outline:
            </span>
            {headings.map((h, i) => (
              <React.Fragment key={`${h.title}-${i}`}>
                {i > 0 && (
                  <span
                    aria-hidden="true"
                    className="text-[var(--border-strong)] text-xs select-none"
                  >
                    ·
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => scrollToHeading(h.title)}
                  className="text-xs font-medium text-[var(--text-secondary)] hover:text-[#FF6A00] dark:hover:text-[#FF8A32] whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {h.title}
                </button>
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Comfortable Textarea Canvas */}
        <div className="flex-1 flex flex-col relative">
          {isDraggingFile && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#FF6A00]/10 backdrop-blur-[1px] pointer-events-none">
              <div className="px-4 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[#FF6A00] text-xs font-semibold text-[#FF6A00] dark:text-[#FF8A32] shadow-lg">
                Drop .txt file to import script
              </div>
            </div>
          )}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleTextareaKeyDown}
            placeholder="Write or paste your script here... Use # for section titles and [PAUSE 2s] for timed breathing pauses."
            aria-label="Teleprompter script editor"
            style={{ fontSize: `${settings.editorFontSize}px` }}
            className={`flex-1 w-full min-h-[380px] sm:min-h-[480px] p-6 sm:p-10 bg-transparent text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/60 leading-[1.75] resize-none focus:outline-none ${
              settings.fontFamily === 'serif'
                ? 'font-serif'
                : settings.fontFamily === 'mono'
                ? 'font-mono'
                : 'font-sans'
            }`}
          />
        </div>

        {/* Bottom Workspace Footer Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-3 border-t border-[var(--border-subtle)] bg-[var(--bg-subtle)]/60 text-xs text-[var(--text-muted)]">
          {/* Quick Editor Font Size & Configurable WPM Pace Controls */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span>Editor Text:</span>
              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({
                    editorFontSize: Math.max(14, settings.editorFontSize - 1),
                  })
                }
                className="p-1 rounded hover:bg-[var(--bg-control)] text-[var(--text-secondary)] cursor-pointer"
                title="Decrease editor text size"
                aria-label="Decrease editor text size"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="font-mono tabular-nums text-[var(--text-primary)] w-8 text-center">
                {settings.editorFontSize}px
              </span>
              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({
                    editorFontSize: Math.min(26, settings.editorFontSize + 1),
                  })
                }
                className="p-1 rounded hover:bg-[var(--bg-control)] text-[var(--text-secondary)] cursor-pointer"
                title="Increase editor text size"
                aria-label="Increase editor text size"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>

            <span aria-hidden="true" className="text-[var(--border-strong)]">
              ·
            </span>

            <div className="flex items-center gap-2">
              <label htmlFor="quick-wpm-slider" className="whitespace-nowrap">
                Speaking Pace:
              </label>
              <input
                id="quick-wpm-slider"
                type="range"
                min={60}
                max={240}
                step={5}
                value={settings.wpm}
                onChange={(e) =>
                  onUpdateSettings({ wpm: Number(e.target.value) })
                }
                className="w-20 sm:w-28 accent-[#FF6A00] cursor-pointer"
              />
              <span className="font-mono tabular-nums text-[var(--text-primary)]">
                {settings.wpm} WPM
              </span>
              {settings.wpm !== 130 && (
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ wpm: 130 })}
                  className="text-[11px] text-[#FF6A00] dark:text-[#FF8A32] hover:underline cursor-pointer"
                  title="Reset pace to 130 WPM default"
                >
                  Reset (130)
                </button>
              )}
            </div>
          </div>

          {/* Right Quick Summary & Launch Link */}
          <div className="flex items-center gap-2.5 font-mono tabular-nums ml-auto">
            <span>{stats.words.toLocaleString()} words</span>
            <span aria-hidden="true">·</span>
            <span>{stats.characters.toLocaleString()} chars</span>
            <span aria-hidden="true">·</span>
            <span className="text-[var(--text-primary)] font-medium">
              Est. {formatDurationReadable(stats.estimatedSeconds)}
            </span>
            {onOpenStudio && (
              <>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={onOpenStudio}
                  className="inline-flex items-center gap-1 font-sans font-semibold text-[var(--text-primary)] hover:text-[#FF6A00] dark:hover:text-[#FF8A32] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Video className="w-3 h-3 text-[#FF6A00] dark:text-[#FF8A32]" />
                  <span>Record Studio</span>
                </button>
              </>
            )}
            {!isEmpty && (
              <>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={onStartTeleprompter}
                  className="inline-flex items-center gap-1 font-sans font-semibold text-[#FF6A00] dark:text-[#FF8A32] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>Prompt Now</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
};
