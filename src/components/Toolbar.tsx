import React, { useRef, useState } from 'react';
import {
  Clock,
  Sparkles,
  Heading,
  Copy,
  Download,
  Upload,
  Trash2,
  Undo2,
  Redo2,
  Gauge,
  Check,
  AlertTriangle,
  Video,
} from 'lucide-react';
import { SaveStatus, ScriptStats } from '../types/teleprompter';
import { formatDurationReadable } from '../utils/scriptMetrics';

interface ToolbarProps {
  stats: ScriptStats;
  wpm: number;
  saveStatus: SaveStatus;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onInsertText: (snippet: string) => void;
  onCleanFormatting: () => void;
  onCopyScript: () => void;
  onDownloadScript: () => void;
  onImportFile: (file: File) => void;
  onClearScriptConfirmed: () => void;
  hasContent: boolean;
  onOpenStudio?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  stats,
  wpm,
  saveStatus,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onInsertText,
  onCleanFormatting,
  onCopyScript,
  onDownloadScript,
  onImportFile,
  onClearScriptConfirmed,
  hasContent,
  onOpenStudio,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onImportFile(file);
    e.target.value = '';
  };

  return (
    <div className="border-b border-[var(--border-subtle)] bg-[var(--bg-toolbar)]/80 px-4 sm:px-6 py-2.5">
      <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Left: Undo/Redo, Authoring Cues, Import/Export & Clear Confirmation */}
        <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {/* Undo & Redo */}
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-control)]/80 disabled:opacity-35 disabled:pointer-events-none whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6A00]"
            title="Undo (Cmd/Ctrl + Z)"
            aria-label="Undo"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Undo</span>
          </button>

          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-control)]/80 disabled:opacity-35 disabled:pointer-events-none whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6A00]"
            title="Redo (Cmd/Ctrl + Shift + Z)"
            aria-label="Redo"
          >
            <Redo2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Redo</span>
          </button>

          <span
            aria-hidden="true"
            className="h-4 w-px bg-[var(--border-strong)] mx-0.5 shrink-0"
          />

          {/* Teleprompter Cues */}
          <button
            type="button"
            onClick={() => onInsertText('\n\n[PAUSE 2s]\n\n')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-control)]/80 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6A00]"
            title="Insert a 2-second pause cue for the teleprompter"
          >
            <Clock className="w-3.5 h-3.5 text-[#FF6A00] dark:text-[#FF8A32]" />
            <span>+ Pause</span>
          </button>

          <button
            type="button"
            onClick={() => onInsertText('\n\n[SLOW]\n\n')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-control)]/80 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6A00]"
            title="Insert a slow-down pacing cue"
          >
            <Gauge className="w-3.5 h-3.5 text-[#FF8A32]" />
            <span>+ Slow</span>
          </button>

          <button
            type="button"
            onClick={() => onInsertText('\n\n# New Section\n\n')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-control)]/80 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6A00]"
            title="Insert a section heading marker"
          >
            <Heading className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <span>+ Section</span>
          </button>

          <span
            aria-hidden="true"
            className="h-4 w-px bg-[var(--border-strong)] mx-0.5 shrink-0"
          />

          <button
            type="button"
            onClick={onCleanFormatting}
            disabled={!hasContent}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-control)]/80 disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6A00]"
            title="Normalize extra blank lines and clean spacing for smooth reading"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#FF6A00] dark:text-[#FF8A32]" />
            <span>Format</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,text/plain,text/markdown"
            onChange={handleFileChange}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-control)]/80 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6A00]"
            title="Import a plain-text .txt or .md script file"
          >
            <Upload className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <span>Import .txt</span>
          </button>

          <button
            type="button"
            onClick={onDownloadScript}
            disabled={!hasContent}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-control)]/80 disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6A00]"
            title="Export script as a downloadable .txt file"
          >
            <Download className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <span>Export .txt</span>
          </button>

          <button
            type="button"
            onClick={onCopyScript}
            disabled={!hasContent}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-control)]/80 disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6A00]"
            title="Copy script to clipboard"
          >
            <Copy className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <span>Copy</span>
          </button>

          {onOpenStudio && (
            <button
              type="button"
              onClick={onOpenStudio}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold text-[#FF6A00] dark:text-[#FF8A32] hover:bg-[#FF6A00]/10 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6A00]"
              title="Open Recording Studio with camera and microphone"
            >
              <Video className="w-3.5 h-3.5" />
              <span>Record Studio</span>
            </button>
          )}

          {/* Clear Script with Confirmation */}
          {confirmingClear ? (
            <div
              onKeyDown={(e) => {
                if (e.key === 'Escape') setConfirmingClear(false);
              }}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-500/10 border border-red-500/30 shrink-0"
            >
              <span className="text-xs font-medium text-red-600 dark:text-red-400 whitespace-nowrap">
                Clear script?
              </span>
              <button
                type="button"
                onClick={() => {
                  onClearScriptConfirmed();
                  setConfirmingClear(false);
                }}
                className="px-2 py-0.5 rounded text-xs font-semibold bg-red-600 text-white hover:bg-red-500 whitespace-nowrap cursor-pointer"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={() => setConfirmingClear(false)}
                className="px-1.5 py-0.5 rounded text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] whitespace-nowrap cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingClear(true)}
              disabled={!hasContent}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-[var(--text-muted)] hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6A00]"
              title="Clear current script text"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}
        </div>

        {/* Right: Unboxed Script Metadata + Auto-Save Indicator with Tabular Numerals */}
        <div
          aria-live="polite"
          className="flex items-center gap-2 text-xs text-[var(--text-muted)] font-mono tabular-nums whitespace-nowrap shrink-0 ml-auto"
        >
          <span>{stats.words.toLocaleString()} words</span>
          <span aria-hidden="true">·</span>
          <span>{stats.characters.toLocaleString()} chars</span>
          <span aria-hidden="true">·</span>
          <span className="text-[var(--text-primary)] font-semibold">
            {formatDurationReadable(stats.estimatedSeconds)} read
          </span>
          <span aria-hidden="true" className="hidden sm:inline">
            ·
          </span>
          <span className="hidden sm:inline">{wpm} WPM</span>
          <span aria-hidden="true">·</span>
          {saveStatus === 'saving' && (
            <span className="font-sans text-[var(--text-muted)]">
              Saving...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="inline-flex items-center gap-1 font-sans text-[var(--text-muted)]">
              <Check className="w-3 h-3 text-[#FF6A00] dark:text-[#FF8A32]" />
              <span>Saved</span>
            </span>
          )}
          {saveStatus === 'error' && (
            <span
              className="inline-flex items-center gap-1 font-sans text-amber-600 dark:text-amber-400"
              title="Browser storage quota reached — export your script as .txt"
            >
              <AlertTriangle className="w-3 h-3" />
              <span>Storage full</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
