/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  SaveStatus,
  ScriptDocument,
  TeleprompterSettings,
  ThemeMode,
  ToastMessage,
} from './types/teleprompter';
import { DEFAULT_SETTINGS, STARTER_SCRIPTS } from './data/defaultScripts';
import { calculateScriptStats } from './utils/scriptMetrics';
import { Navbar } from './components/Navbar';
import { Toolbar } from './components/Toolbar';
import { ScriptEditor } from './components/ScriptEditor';
import { SettingsPanel } from './components/SettingsPanel';
import { ScriptLibraryModal } from './components/ScriptLibraryModal';
import { ShortcutsModal } from './components/ShortcutsModal';
import { TeleprompterView } from './components/TeleprompterView';
import { RecordingStudioView } from './components/RecordingStudioView';
import { FlowPromptLogo } from './components/FlowPromptLogo';

const STORAGE_KEYS = {
  THEME: 'flowprompt_theme_v1',
  SETTINGS: 'flowprompt_settings_v1',
  SCRIPTS: 'flowprompt_scripts_v1',
  ACTIVE_SCRIPT_ID: 'flowprompt_active_script_id_v1',
};

interface UndoHistoryEntry {
  past: string[];
  future: string[];
}

const MAX_UNDO_STEPS = 50;
const MAX_IMPORT_BYTES = 5 * 1024 * 1024; // 5 MB safety ceiling for plain text

export default function App() {
  // 1. Theme state: respects saved preference first, then system prefers-color-scheme
  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.THEME);
      if (saved === 'dark' || saved === 'light') return saved;
      if (
        typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches
      ) {
        return 'dark';
      }
    } catch {
      // Ignore storage errors
    }
    return 'light';
  });

  // Synchronize root .dark class immediately on theme change
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Listen to OS color-scheme changes if user has not locked a preference in localStorage
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      try {
        const saved = localStorage.getItem(STORAGE_KEYS.THEME);
        if (saved === 'dark' || saved === 'light') return;
      } catch {
        // Ignore
      }
      setTheme(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const handleToggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: ThemeMode = prev === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(STORAGE_KEYS.THEME, next);
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  }, []);

  // 2. Teleprompter reading settings (defaults to 130 WPM)
  const [settings, setSettings] = useState<TeleprompterSettings>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (raw) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
      }
    } catch {
      // Ignore storage errors
    }
    return DEFAULT_SETTINGS;
  });

  const updateSettings = useCallback(
    (partial: Partial<TeleprompterSettings>) => {
      setSettings((prev) => {
        const updated = { ...prev, ...partial };
        try {
          localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
        } catch {
          // Ignore storage errors
        }
        return updated;
      });
    },
    []
  );

  // 3. Script Library & Active Script state
  const [scripts, setScripts] = useState<ScriptDocument[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SCRIPTS);
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch {
      // Ignore storage errors
    }
    return STARTER_SCRIPTS;
  });

  const [activeScriptId, setActiveScriptId] = useState<string>(() => {
    try {
      const savedId = localStorage.getItem(STORAGE_KEYS.ACTIVE_SCRIPT_ID);
      if (savedId) return savedId;
    } catch {
      // Ignore
    }
    return STARTER_SCRIPTS[0].id;
  });

  // Keep activeScriptId aligned with available scripts
  useEffect(() => {
    if (scripts.length > 0 && !scripts.some((s) => s.id === activeScriptId)) {
      setActiveScriptId(scripts[0].id);
    }
  }, [scripts, activeScriptId]);

  // 4. Auto-save status indicator & Toast notifications
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const saveTimerRef = useRef<number | null>(null);

  const showToast = useCallback(
    (text: string, type: ToastMessage['type'] = 'info') => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev.slice(-2), { id, text, type }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 2800);
    },
    []
  );

  // Persist scripts with clear saving/saved/error indicator
  useEffect(() => {
    setSaveStatus('saving');
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    try {
      localStorage.setItem(STORAGE_KEYS.SCRIPTS, JSON.stringify(scripts));
      localStorage.setItem(STORAGE_KEYS.ACTIVE_SCRIPT_ID, activeScriptId);
      saveTimerRef.current = window.setTimeout(() => {
        setSaveStatus('saved');
      }, 320);
    } catch {
      setSaveStatus('error');
      showToast(
        'Browser storage is full — export your script as a .txt file to back up.',
        'warning'
      );
    }

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [scripts, activeScriptId, showToast]);

  const activeScript = useMemo<ScriptDocument>(() => {
    const found = scripts.find((s) => s.id === activeScriptId);
    if (found) return found;
    if (scripts.length > 0) return scripts[0];
    return {
      id: 'draft-empty-script',
      title: 'Untitled Script',
      content: '',
      category: 'Personal',
      updatedAt: Date.now(),
    };
  }, [scripts, activeScriptId]);

  // 5. Undo / Redo History Management per Script
  const historyMapRef = useRef<Record<string, UndoHistoryEntry>>({});
  const lastEditTimestampRef = useRef<number>(0);
  const [, setHistoryVersion] = useState(0); // Triggers re-render for canUndo/canRedo

  const getHistory = useCallback((scriptId: string): UndoHistoryEntry => {
    if (!historyMapRef.current[scriptId]) {
      historyMapRef.current[scriptId] = { past: [], future: [] };
    }
    return historyMapRef.current[scriptId];
  }, []);

  const recordUndoSnapshot = useCallback(
    (scriptId: string, previousContent: string, coalesceTyping = false) => {
      const entry = getHistory(scriptId);
      const now = Date.now();

      if (
        coalesceTyping &&
        now - lastEditTimestampRef.current < 550 &&
        entry.past.length > 0
      ) {
        // Coalesce rapid keystrokes into the existing snapshot
        entry.future = [];
        lastEditTimestampRef.current = now;
        return;
      }

      if (entry.past[entry.past.length - 1] !== previousContent) {
        entry.past = [...entry.past.slice(-(MAX_UNDO_STEPS - 1)), previousContent];
      }
      entry.future = [];
      lastEditTimestampRef.current = now;
      setHistoryVersion((v) => v + 1);
    },
    [getHistory]
  );

  const currentHistory = getHistory(activeScript.id);
  const canUndo = currentHistory.past.length > 0;
  const canRedo = currentHistory.future.length > 0;

  // Update active script content or title (creates a script if library was completely emptied)
  const updateActiveScript = useCallback(
    (
      changes: Partial<Pick<ScriptDocument, 'title' | 'content' | 'category'>>,
      options?: { recordUndo?: boolean; coalesceTyping?: boolean }
    ) => {
      if (
        options?.recordUndo &&
        typeof changes.content === 'string' &&
        changes.content !== activeScript.content
      ) {
        recordUndoSnapshot(
          activeScript.id,
          activeScript.content,
          Boolean(options.coalesceTyping)
        );
      }

      setScripts((prev) => {
        const exists = prev.some((doc) => doc.id === activeScript.id);
        if (!exists) {
          const created: ScriptDocument = {
            ...activeScript,
            ...changes,
            updatedAt: Date.now(),
          };
          setActiveScriptId(created.id);
          return [created];
        }
        return prev.map((doc) =>
          doc.id === activeScript.id
            ? { ...doc, ...changes, updatedAt: Date.now() }
            : doc
        );
      });
    },
    [activeScript, recordUndoSnapshot]
  );

  const handleUndo = useCallback(() => {
    const entry = getHistory(activeScript.id);
    if (entry.past.length === 0) return;

    const previous = entry.past[entry.past.length - 1];
    entry.past = entry.past.slice(0, -1);
    entry.future = [activeScript.content, ...entry.future].slice(
      0,
      MAX_UNDO_STEPS
    );
    setHistoryVersion((v) => v + 1);
    updateActiveScript({ content: previous }, { recordUndo: false });
  }, [activeScript.id, activeScript.content, getHistory, updateActiveScript]);

  const handleRedo = useCallback(() => {
    const entry = getHistory(activeScript.id);
    if (entry.future.length === 0) return;

    const next = entry.future[0];
    entry.future = entry.future.slice(1);
    entry.past = [...entry.past, activeScript.content].slice(-MAX_UNDO_STEPS);
    setHistoryVersion((v) => v + 1);
    updateActiveScript({ content: next }, { recordUndo: false });
  }, [activeScript.id, activeScript.content, getHistory, updateActiveScript]);

  // 6. UI Modals & Teleprompter / Studio Screen Mode
  const [isTeleprompterActive, setIsTeleprompterActive] = useState(false);
  const [isStudioActive, setIsStudioActive] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Compute live script metrics
  const stats = useMemo(
    () => calculateScriptStats(activeScript.content, settings.wpm),
    [activeScript.content, settings.wpm]
  );

  const hasContent = activeScript.content.trim().length > 0;

  // Insert cue or heading at current cursor position in textarea
  const handleInsertText = useCallback(
    (snippet: string) => {
      const textarea = textareaRef.current;
      if (!textarea) {
        updateActiveScript(
          { content: activeScript.content + snippet },
          { recordUndo: true }
        );
        return;
      }

      const start = textarea.selectionStart ?? activeScript.content.length;
      const end = textarea.selectionEnd ?? activeScript.content.length;
      const before = activeScript.content.slice(0, start);
      const after = activeScript.content.slice(end);
      const nextContent = `${before}${snippet}${after}`;

      updateActiveScript({ content: nextContent }, { recordUndo: true });

      window.requestAnimationFrame(() => {
        textarea.focus();
        const cursor = start + snippet.length;
        textarea.setSelectionRange(cursor, cursor);
      });
    },
    [activeScript.content, updateActiveScript]
  );

  // Format and normalize spacing
  const handleCleanFormatting = useCallback(() => {
    if (!hasContent) return;
    const cleaned = activeScript.content
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map((line) => line.trimEnd())
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (cleaned === activeScript.content) {
      showToast('Script spacing is already clean');
      return;
    }

    updateActiveScript({ content: cleaned }, { recordUndo: true });
    showToast('Normalized paragraph spacing');
  }, [activeScript.content, hasContent, updateActiveScript, showToast]);

  // Copy script to clipboard
  const handleCopyScript = useCallback(async () => {
    if (!hasContent) return;
    try {
      await navigator.clipboard.writeText(activeScript.content);
      showToast('Copied script to clipboard');
    } catch {
      showToast('Unable to access clipboard');
    }
  }, [activeScript.content, hasContent, showToast]);

  // Paste from clipboard (used in empty state)
  const handlePasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        updateActiveScript({ content: text }, { recordUndo: true });
        showToast('Pasted script from clipboard');
      } else {
        showToast('Clipboard is empty — type or paste with Cmd/Ctrl+V');
        textareaRef.current?.focus();
      }
    } catch {
      showToast('Press Cmd/Ctrl+V inside the editor to paste');
      textareaRef.current?.focus();
    }
  }, [updateActiveScript, showToast]);

  // Export any script as downloadable .txt file
  const handleExportScriptDocument = useCallback(
    (doc: ScriptDocument) => {
      const blob = new Blob([doc.content], {
        type: 'text/plain;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const safeFilename =
        doc.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '') || 'flowprompt-script';
      link.href = url;
      link.download = `${safeFilename}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast(`Exported ${safeFilename}.txt`);
    },
    [showToast]
  );

  // Import plain-text .txt or .md file with graceful handling of empty & long files
  const handleImportFile = useCallback(
    (file: File) => {
      if (file.size > MAX_IMPORT_BYTES) {
        showToast(
          'File exceeds 5 MB limit — please import a smaller plain-text file.',
          'warning'
        );
        return;
      }

      const reader = new FileReader();
      reader.onerror = () => {
        showToast(`Could not read "${file.name}"`, 'warning');
      };
      reader.onload = (event) => {
        const rawResult = event.target?.result;
        if (typeof rawResult !== 'string') {
          showToast(`Unsupported file format for "${file.name}"`, 'warning');
          return;
        }

        const cleanName =
          file.name.replace(/\.(txt|md|text)$/i, '').trim() ||
          'Imported Script';
        const normalizedContent = rawResult.replace(/\r\n/g, '\n');

        const newDoc: ScriptDocument = {
          id: `script-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          title: cleanName,
          content: normalizedContent,
          category: 'Imported',
          updatedAt: Date.now(),
        };

        setScripts((prev) => [newDoc, ...prev]);
        setActiveScriptId(newDoc.id);

        if (normalizedContent.trim().length === 0) {
          showToast(`Imported empty file "${cleanName}"`);
        } else {
          const importedStats = calculateScriptStats(
            normalizedContent,
            settings.wpm
          );
          showToast(
            `Imported "${cleanName}" (${importedStats.words.toLocaleString()} words)`
          );
        }
      };

      reader.readAsText(file);
    },
    [settings.wpm, showToast]
  );

  // Clear script after confirmation (records undo snapshot so user can still Undo)
  const handleClearScriptConfirmed = useCallback(() => {
    if (!hasContent) return;
    updateActiveScript({ content: '' }, { recordUndo: true });
    showToast('Cleared script · Press Undo to restore');
  }, [hasContent, updateActiveScript, showToast]);

  // Script Library operations
  const handleCreateNewScript = useCallback(() => {
    const newDoc: ScriptDocument = {
      id: `script-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: 'Untitled Script',
      content: '',
      category: 'Personal',
      updatedAt: Date.now(),
    };
    setScripts((prev) => [newDoc, ...prev]);
    setActiveScriptId(newDoc.id);
    showToast('Created new blank script');
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }, [showToast]);

  const handleRenameScript = useCallback(
    (id: string, newTitle: string) => {
      setScripts((prev) =>
        prev.map((doc) =>
          doc.id === id
            ? { ...doc, title: newTitle, updatedAt: Date.now() }
            : doc
        )
      );
      showToast(`Renamed to "${newTitle}"`);
    },
    [showToast]
  );

  const handleDuplicateScript = useCallback(
    (doc: ScriptDocument) => {
      const copy: ScriptDocument = {
        ...doc,
        id: `script-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: `${doc.title} (Copy)`,
        updatedAt: Date.now(),
      };
      setScripts((prev) => [copy, ...prev]);
      setActiveScriptId(copy.id);
      showToast(`Duplicated "${doc.title}"`);
    },
    [showToast]
  );

  const handleDeleteScript = useCallback(
    (id: string) => {
      const target = scripts.find((s) => s.id === id);
      setScripts((prev) => {
        const filtered = prev.filter((s) => s.id !== id);
        if (id === activeScriptId) {
          setActiveScriptId(filtered[0]?.id || 'draft-empty-script');
        }
        return filtered;
      });
      delete historyMapRef.current[id];
      showToast(
        target ? `Deleted "${target.title}"` : 'Deleted script from library'
      );
    },
    [scripts, activeScriptId, showToast]
  );

  const handleLoadTemplate = useCallback(
    (template: ScriptDocument) => {
      if (!hasContent && scripts.length <= 1) {
        updateActiveScript(
          {
            title: template.title,
            content: template.content,
            category: template.category,
          },
          { recordUndo: true }
        );
        showToast(`Loaded "${template.title}"`);
      } else {
        const newDoc: ScriptDocument = {
          ...template,
          id: `script-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          updatedAt: Date.now(),
        };
        setScripts((prev) => [newDoc, ...prev]);
        setActiveScriptId(newDoc.id);
        showToast(`Opened template "${template.title}"`);
      }
    },
    [hasContent, scripts.length, updateActiveScript, showToast]
  );

  // Global Editor keyboard shortcuts (Start Teleprompter, Preferences, Undo/Redo)
  useEffect(() => {
    if (isTeleprompterActive || isStudioActive) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        if (hasContent) {
          e.preventDefault();
          setIsTeleprompterActive(true);
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        setIsSettingsOpen((prev) => !prev);
      } else if (
        (e.metaKey || e.ctrlKey) &&
        !e.shiftKey &&
        e.key.toLowerCase() === 'z'
      ) {
        if (canUndo) {
          e.preventDefault();
          handleUndo();
        }
      } else if (
        ((e.metaKey || e.ctrlKey) &&
          e.shiftKey &&
          e.key.toLowerCase() === 'z') ||
        ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y')
      ) {
        if (canRedo) {
          e.preventDefault();
          handleRedo();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [
    isTeleprompterActive,
    isStudioActive,
    hasContent,
    canUndo,
    canRedo,
    handleUndo,
    handleRedo,
  ]);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      {/* Top Navigation */}
      <Navbar
        scriptTitle={activeScript.title}
        onUpdateTitle={(title) => updateActiveScript({ title })}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        isSettingsOpen={isSettingsOpen}
        onToggleSettings={() => setIsSettingsOpen((prev) => !prev)}
        onOpenLibrary={() => setIsLibraryOpen(true)}
        onCreateNewScript={handleCreateNewScript}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        onStartTeleprompter={() => {
          if (hasContent) {
            setIsTeleprompterActive(true);
          }
        }}
        onOpenStudio={() => {
          setIsStudioActive(true);
        }}
        scriptCount={scripts.length}
        hasContent={hasContent}
      />

      {/* Compact Authoring & Metrics Toolbar */}
      <Toolbar
        stats={stats}
        wpm={settings.wpm}
        saveStatus={saveStatus}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onInsertText={handleInsertText}
        onCleanFormatting={handleCleanFormatting}
        onCopyScript={handleCopyScript}
        onDownloadScript={() => handleExportScriptDocument(activeScript)}
        onImportFile={handleImportFile}
        onClearScriptConfirmed={handleClearScriptConfirmed}
        hasContent={hasContent}
        onOpenStudio={() => setIsStudioActive(true)}
      />

      {/* Main Script Editor Workspace */}
      <ScriptEditor
        content={activeScript.content}
        onChange={(content) =>
          updateActiveScript(
            { content },
            { recordUndo: true, coalesceTyping: true }
          )
        }
        textareaRef={textareaRef}
        settings={settings}
        onUpdateSettings={updateSettings}
        stats={stats}
        onSelectTemplate={handleLoadTemplate}
        onPasteFromClipboard={handlePasteFromClipboard}
        onImportFile={handleImportFile}
        onStartTeleprompter={() => {
          if (hasContent) {
            setIsTeleprompterActive(true);
          }
        }}
        onOpenStudio={() => {
          setIsStudioActive(true);
        }}
      />

      {/* Quiet Minimal Footer with Monochrome Logo Variant */}
      <footer className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--text-muted)] border-t border-[var(--border-subtle)]">
        <div className="flex items-center gap-2">
          <FlowPromptLogo variant="monochrome" size={15} />
          <span>FLOWPROMPT Studio · Auto-saved to local storage</span>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setIsStudioActive(true)}
            className="text-[#FF6A00] dark:text-[#FF8A32] font-semibold hover:underline transition-colors cursor-pointer"
          >
            Record Studio
          </button>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={() => setIsLibraryOpen(true)}
            className="hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            Script Library ({scripts.length})
          </button>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            Reading Setup
          </button>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={() => setIsShortcutsOpen(true)}
            className="hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            Keyboard Shortcuts
          </button>
        </div>
      </footer>

      {/* Slide-Over Reading Preferences Drawer */}
      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={updateSettings}
        onResetSettings={() => {
          updateSettings(DEFAULT_SETTINGS);
          showToast('Restored default reading preferences (130 WPM)');
        }}
        onStartTeleprompter={() => {
          if (hasContent) {
            setIsTeleprompterActive(true);
          }
        }}
        hasContent={hasContent}
      />

      {/* Slide-Over Script Library Drawer */}
      <ScriptLibraryModal
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        scripts={scripts}
        activeScriptId={activeScript.id}
        wpm={settings.wpm}
        onSelectScript={(id) => {
          setActiveScriptId(id);
        }}
        onCreateNewScript={handleCreateNewScript}
        onRenameScript={handleRenameScript}
        onDuplicateScript={handleDuplicateScript}
        onDeleteScript={handleDeleteScript}
        onExportScript={handleExportScriptDocument}
        onImportFile={handleImportFile}
        onLoadTemplate={handleLoadTemplate}
      />

      {/* Keyboard Shortcuts Modal */}
      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      {/* Separate Immersive Teleprompter Screen */}
      {isTeleprompterActive && (
        <TeleprompterView
          scriptTitle={activeScript.title}
          content={activeScript.content}
          settings={settings}
          stats={stats}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          onUpdateSettings={updateSettings}
          onExit={() => setIsTeleprompterActive(false)}
        />
      )}

      {/* Professional Recording Studio Screen */}
      {isStudioActive && (
        <RecordingStudioView
          scriptTitle={activeScript.title}
          content={activeScript.content}
          settings={settings}
          stats={stats}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          onUpdateSettings={updateSettings}
          onExit={() => setIsStudioActive(false)}
        />
      )}

      {/* Subtle Toast Notifications */}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none"
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`px-3.5 py-2 rounded-xl text-xs font-medium shadow-lg border ${
                t.type === 'warning'
                  ? 'bg-amber-950 text-amber-100 border-amber-700/60'
                  : 'bg-[#171717] text-[#FAF9F6] dark:bg-[#FAF9F6] dark:text-[#171717] border-white/15'
              }`}
            >
              {t.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
