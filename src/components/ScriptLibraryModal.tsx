import React, { useState, useMemo, useRef } from 'react';
import {
  X,
  Plus,
  FileText,
  Trash2,
  Copy,
  Sparkles,
  Check,
  Search,
  Pencil,
  Upload,
  Download,
  Clock,
} from 'lucide-react';
import { ScriptDocument } from '../types/teleprompter';
import { STARTER_SCRIPTS } from '../data/defaultScripts';
import {
  calculateScriptStats,
  formatDurationReadable,
  formatRelativeTime,
} from '../utils/scriptMetrics';
import { FlowPromptLogo } from './FlowPromptLogo';

interface ScriptLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  scripts: ScriptDocument[];
  activeScriptId: string;
  wpm: number;
  onSelectScript: (id: string) => void;
  onCreateNewScript: () => void;
  onRenameScript: (id: string, newTitle: string) => void;
  onDuplicateScript: (script: ScriptDocument) => void;
  onDeleteScript: (id: string) => void;
  onExportScript: (script: ScriptDocument) => void;
  onImportFile: (file: File) => void;
  onLoadTemplate: (template: ScriptDocument) => void;
}

export const ScriptLibraryModal: React.FC<ScriptLibraryModalProps> = ({
  isOpen,
  onClose,
  scripts,
  activeScriptId,
  wpm,
  onSelectScript,
  onCreateNewScript,
  onRenameScript,
  onDuplicateScript,
  onDeleteScript,
  onExportScript,
  onImportFile,
  onLoadTemplate,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'recent'>('all');
  const [editingScriptId, setEditingScriptId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredScripts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const list = scripts.filter((doc) => {
      if (!query) return true;
      return (
        doc.title.toLowerCase().includes(query) ||
        doc.category.toLowerCase().includes(query) ||
        doc.content.toLowerCase().includes(query)
      );
    });

    const sorted = [...list].sort((a, b) => b.updatedAt - a.updatedAt);

    if (activeFilter === 'recent') {
      return sorted.slice(0, 5);
    }
    return sorted;
  }, [scripts, searchQuery, activeFilter]);

  if (!isOpen) return null;

  const startRenaming = (doc: ScriptDocument) => {
    setEditingScriptId(doc.id);
    setDraftTitle(doc.title);
    setConfirmDeleteId(null);
  };

  const commitRename = (id: string) => {
    const trimmed = draftTitle.trim();
    onRenameScript(id, trimmed || 'Untitled Script');
    setEditingScriptId(null);
  };

  return (
    <div
      className="fixed inset-0 z-40 flex justify-start bg-black/35 dark:bg-black/60 backdrop-blur-[1px]"
      onClick={onClose}
    >
      <aside
        aria-label="Script Library"
        className="w-full max-w-md bg-[var(--bg-canvas)] border-r border-[var(--border-subtle)] h-full flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
          <div className="flex items-center gap-2.5">
            <FlowPromptLogo variant="icon" size={20} />
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)] leading-tight">
                Script Library
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Auto-saved in browser storage
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,text/plain,text/markdown"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  onImportFile(file);
                  onClose();
                }
                e.target.value = '';
              }}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-[var(--border-strong)] bg-[var(--bg-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-control)] whitespace-nowrap shrink-0 cursor-pointer"
              title="Import a .txt file into your library"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onCreateNewScript();
                onClose();
              }}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#FF6A00] text-white hover:bg-[#E65F00] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-control)] cursor-pointer"
              aria-label="Close script library"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="px-6 pt-4 pb-3 border-b border-[var(--border-subtle)] space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search scripts by title or text..."
              aria-label="Search saved scripts"
              className="w-full pl-9 pr-8 py-2 text-xs bg-[var(--bg-elevated)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] border border-[var(--border-subtle)] rounded-lg focus:outline-none focus:border-[#FF6A00]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                aria-label="Clear search query"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 p-1 bg-[var(--bg-control)] rounded-lg">
              <button
                type="button"
                onClick={() => setActiveFilter('all')}
                className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap shrink-0 cursor-pointer ${
                  activeFilter === 'all'
                    ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-2xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                All Scripts ({scripts.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('recent')}
                className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap shrink-0 cursor-pointer ${
                  activeFilter === 'recent'
                    ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-2xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Clock className="w-3 h-3" />
                <span>Recently Edited</span>
              </button>
            </div>
          </div>
        </div>

        {/* Script List & Empty States */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          <div className="space-y-2.5">
            {scripts.length === 0 ? (
              <div className="p-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-center space-y-3">
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  Your script library is empty
                </p>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  Create a blank script, import a .txt file, or select a studio template below.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onCreateNewScript();
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#FF6A00] text-white hover:bg-[#E65F00] cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Blank Script</span>
                </button>
              </div>
            ) : filteredScripts.length === 0 ? (
              <div className="p-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-center space-y-2.5">
                <p className="text-xs font-semibold text-[var(--text-primary)]">
                  No scripts matching "{searchQuery}"
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  Try searching for another keyword or clear your filter.
                </p>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--border-strong)] bg-[var(--bg-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-control)] cursor-pointer"
                >
                  Clear Search
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredScripts.map((doc) => {
                  const isSelected = doc.id === activeScriptId;
                  const isRenaming = editingScriptId === doc.id;
                  const isConfirmingDelete = confirmDeleteId === doc.id;
                  const docStats = calculateScriptStats(doc.content, wpm);

                  return (
                    <div
                      key={doc.id}
                      className={`group rounded-xl border p-3.5 ${
                        isSelected
                          ? 'bg-[var(--bg-elevated)] border-[#FF6A00] shadow-2xs'
                          : 'bg-[var(--bg-elevated)]/60 border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
                      }`}
                    >
                      {isRenaming ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={draftTitle}
                            onChange={(e) => setDraftTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitRename(doc.id);
                              if (e.key === 'Escape') setEditingScriptId(null);
                            }}
                            autoFocus
                            aria-label="Rename script"
                            className="flex-1 px-2.5 py-1 text-xs font-medium bg-[var(--bg-canvas)] text-[var(--text-primary)] border border-[#FF6A00] rounded-md focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => commitRename(doc.id)}
                            className="px-2.5 py-1 rounded-md text-xs font-semibold bg-[#FF6A00] text-white hover:bg-[#E65F00] cursor-pointer"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingScriptId(null)}
                            className="px-2 py-1 rounded-md text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : isConfirmingDelete ? (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-red-600 dark:text-red-400 truncate">
                            Delete "{doc.title}"?
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteScript(doc.id);
                                setConfirmDeleteId(null);
                              }}
                              className="px-2.5 py-1 rounded-md text-xs font-semibold bg-red-600 text-white hover:bg-red-500 cursor-pointer"
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 rounded-md text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              onSelectScript(doc.id);
                              onClose();
                            }}
                            className="flex-1 min-w-0 text-left cursor-pointer"
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-semibold text-[var(--text-primary)] truncate">
                                {doc.title}
                              </span>
                              {isSelected && (
                                <Check className="w-3.5 h-3.5 text-[#FF6A00] dark:text-[#FF8A32] shrink-0" />
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1 text-xs text-[var(--text-muted)] font-mono tabular-nums">
                              <span>{docStats.words} words</span>
                              <span aria-hidden="true">·</span>
                              <span>
                                {formatDurationReadable(docStats.estimatedSeconds)}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="font-sans">
                                {formatRelativeTime(doc.updatedAt)}
                              </span>
                            </div>
                          </button>

                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => startRenaming(doc)}
                              className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-control)] cursor-pointer"
                              title="Rename script"
                              aria-label={`Rename ${doc.title}`}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDuplicateScript(doc)}
                              className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-control)] cursor-pointer"
                              title="Duplicate script"
                              aria-label={`Duplicate ${doc.title}`}
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onExportScript(doc)}
                              className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-control)] cursor-pointer"
                              title="Export as .txt"
                              aria-label={`Export ${doc.title}`}
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(doc.id)}
                              className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 cursor-pointer"
                              title="Delete script"
                              aria-label={`Delete ${doc.title}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Starter Studio Templates */}
          <div className="space-y-2.5 pt-4 border-t border-[var(--border-subtle)]">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)]">
              <Sparkles className="w-3.5 h-3.5 text-[#FF6A00] dark:text-[#FF8A32]" />
              <span>Studio Templates</span>
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              Load a pre-formatted script with pacing cues into your library:
            </p>
            <div className="space-y-2">
              {STARTER_SCRIPTS.map((tpl) => {
                const tplStats = calculateScriptStats(tpl.content, wpm);
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => {
                      onLoadTemplate(tpl);
                      onClose();
                    }}
                    className="w-full flex items-start gap-3 p-3 rounded-xl border border-[var(--border-subtle)] hover:border-[#FF6A00]/60 bg-[var(--bg-elevated)]/60 text-left cursor-pointer"
                  >
                    <FileText className="w-4 h-4 text-[var(--text-muted)] mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-[var(--text-primary)] truncate">
                        {tpl.title}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-[var(--text-muted)] font-mono tabular-nums">
                        <span className="font-sans">{tpl.category}</span>
                        <span aria-hidden="true">·</span>
                        <span>{tplStats.words} words</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {formatDurationReadable(tplStats.estimatedSeconds)}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
};
