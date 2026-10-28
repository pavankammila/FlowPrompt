import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  SlidersHorizontal,
  Sun,
  Moon,
  FolderOpen,
  Keyboard,
  Check,
  Pencil,
  FilePlus2,
  Video,
} from 'lucide-react';
import { ThemeMode } from '../types/teleprompter';
import { FlowPromptLogo } from './FlowPromptLogo';

interface NavbarProps {
  scriptTitle: string;
  onUpdateTitle: (newTitle: string) => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  isSettingsOpen: boolean;
  onToggleSettings: () => void;
  onOpenLibrary: () => void;
  onCreateNewScript: () => void;
  onOpenShortcuts: () => void;
  onStartTeleprompter: () => void;
  onOpenStudio: () => void;
  scriptCount: number;
  hasContent: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  scriptTitle,
  onUpdateTitle,
  theme,
  onToggleTheme,
  isSettingsOpen,
  onToggleSettings,
  onOpenLibrary,
  onCreateNewScript,
  onOpenShortcuts,
  onStartTeleprompter,
  onOpenStudio,
  scriptCount,
  hasContent,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(scriptTitle);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraftTitle(scriptTitle);
  }, [scriptTitle]);

  useEffect(() => {
    if (isEditingTitle && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingTitle]);

  const commitTitle = () => {
    const trimmed = draftTitle.trim();
    onUpdateTitle(trimmed || 'Untitled Script');
    setIsEditingTitle(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commitTitle();
    } else if (e.key === 'Escape') {
      setDraftTitle(scriptTitle);
      setIsEditingTitle(false);
    }
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 md:gap-8 px-4 sm:px-6 h-16 bg-[var(--bg-canvas)]/95 backdrop-blur-md border-b border-[var(--border-subtle)]">
      {/* Zone 1: Authentic FLOWPROMPT Brand Logo (Icon + Wordmark on sm+, Icon-only on xs) */}
      <a
        href="#workspace"
        onClick={(e) => {
          e.preventDefault();
          onOpenLibrary();
        }}
        aria-label="FLOWPROMPT — Open Script Library"
        title="FLOWPROMPT — Open Script Library"
        className="inline-flex items-center rounded-lg py-1 pr-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6A00] whitespace-nowrap shrink-0"
      >
        <FlowPromptLogo variant="full" size={26} responsiveWordmark />
      </a>

      {/* Zone 2: Script Title & Workspace Navigation Links */}
      <nav
        aria-label="Workspace navigation"
        className="flex items-center gap-2 sm:gap-5 min-w-0 flex-1 justify-center"
      >
        {/* Editable Current Script Title */}
        <div className="flex items-center min-w-0 max-w-[160px] sm:max-w-xs md:max-w-md">
          {isEditingTitle ? (
            <div className="flex items-center gap-1.5">
              <input
                ref={inputRef}
                type="text"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                onBlur={commitTitle}
                onKeyDown={handleKeyDown}
                aria-label="Edit script title"
                className="px-2.5 py-1 text-sm font-medium bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[#FF6A00] rounded-md focus:outline-none w-40 sm:w-64"
              />
              <button
                type="button"
                onClick={commitTitle}
                className="p-1.5 text-[#FF6A00] dark:text-[#FF8A32] hover:bg-[var(--bg-control)] rounded-md shrink-0 cursor-pointer"
                title="Save title"
              >
                <Check className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingTitle(true)}
              className="group flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-control)]/70 max-w-full truncate cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6A00]"
              title="Click to rename script"
            >
              <span className="truncate">{scriptTitle}</span>
              <Pencil className="w-3.5 h-3.5 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>
          )}
        </div>

        <span
          aria-hidden="true"
          className="hidden lg:inline text-[var(--border-strong)] select-none"
        >
          /
        </span>

        {/* Clean Single-Line Navigation Controls */}
        <div className="hidden lg:flex items-center gap-5 text-sm font-medium text-[var(--text-muted)]">
          <button
            type="button"
            onClick={onOpenLibrary}
            className="flex items-center gap-1.5 hover:text-[var(--text-primary)] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6A00] rounded px-1 py-0.5"
            title="Browse, search, and manage saved scripts"
          >
            <FolderOpen className="w-4 h-4 text-[var(--text-muted)]" />
            <span>Scripts ({scriptCount})</span>
          </button>

          <button
            type="button"
            onClick={onCreateNewScript}
            className="flex items-center gap-1.5 hover:text-[var(--text-primary)] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6A00] rounded px-1 py-0.5"
            title="Create a new blank script"
          >
            <FilePlus2 className="w-4 h-4 text-[var(--text-muted)]" />
            <span>New</span>
          </button>

          <button
            type="button"
            onClick={onOpenStudio}
            className="flex items-center gap-1.5 hover:text-[var(--text-primary)] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6A00] rounded px-1 py-0.5"
            title="Open Recording Studio"
          >
            <Video className="w-4 h-4 text-[#FF6A00] dark:text-[#FF8A32]" />
            <span>Studio</span>
          </button>

          <button
            type="button"
            onClick={onToggleSettings}
            aria-expanded={isSettingsOpen}
            className={`flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6A00] rounded px-1 py-0.5 ${
              isSettingsOpen
                ? 'text-[#FF6A00] dark:text-[#FF8A32] font-semibold'
                : 'hover:text-[var(--text-primary)]'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Reading Setup</span>
          </button>

          <button
            type="button"
            onClick={onOpenShortcuts}
            className="flex items-center gap-1.5 hover:text-[var(--text-primary)] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6A00] rounded px-1 py-0.5"
          >
            <Keyboard className="w-4 h-4 text-[var(--text-muted)]" />
            <span>Shortcuts</span>
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            className="flex items-center gap-1.5 hover:text-[var(--text-primary)] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6A00] rounded px-1 py-0.5"
            title={
              theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
            }
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-4 h-4 text-[#FF8A32]" />
                <span>Light</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-[var(--text-muted)]" />
                <span>Dark</span>
              </>
            )}
          </button>
        </div>
      </nav>

      {/* Zone 3: Compact Icons + Studio & Primary Action CTA */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        <button
          type="button"
          onClick={onOpenLibrary}
          className="lg:hidden p-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-control)]/70 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6A00]"
          title="Scripts Library"
          aria-label="Scripts Library"
        >
          <FolderOpen className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onCreateNewScript}
          className="lg:hidden p-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-control)]/70 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6A00]"
          title="New Script"
          aria-label="New Script"
        >
          <FilePlus2 className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onToggleSettings}
          className={`lg:hidden p-2 rounded-lg cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6A00] ${
            isSettingsOpen
              ? 'bg-[#FF6A00]/10 text-[#FF6A00] dark:text-[#FF8A32]'
              : 'text-[var(--text-secondary)] hover:bg-[var(--bg-control)]/70'
          }`}
          title="Reading Setup"
          aria-label="Reading Setup"
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onToggleTheme}
          className="lg:hidden p-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-control)]/70 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6A00]"
          title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-[#FF8A32]" />
          ) : (
            <Moon className="w-4 h-4" />
          )}
        </button>

        <button
          type="button"
          onClick={onOpenStudio}
          className="sm:hidden p-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-control)]/70 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6A00]"
          title="Open Recording Studio"
          aria-label="Open Recording Studio"
        >
          <Video className="w-4 h-4 text-[#FF6A00] dark:text-[#FF8A32]" />
        </button>

        <button
          type="button"
          onClick={onOpenStudio}
          className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold border whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6A00] bg-[var(--bg-elevated)] border-[var(--border-strong)] text-[var(--text-primary)] hover:bg-[var(--bg-control)]/80 cursor-pointer shadow-2xs"
          title="Record video and audio with live teleprompter"
        >
          <Video className="w-4 h-4 text-[#FF6A00] dark:text-[#FF8A32]" />
          <span>Record Studio</span>
        </button>

        <button
          type="button"
          onClick={onStartTeleprompter}
          disabled={!hasContent}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6A00] focus-visible:ring-offset-2 ${
            hasContent
              ? 'bg-[#FF6A00] hover:bg-[#E65F00] active:scale-[0.99] text-white shadow-xs cursor-pointer'
              : 'bg-[var(--bg-control)] text-[var(--text-muted)] cursor-not-allowed opacity-60'
          }`}
          title={
            hasContent
              ? 'Launch fullscreen teleprompter (Cmd/Ctrl + Enter)'
              : 'Add script text before launching the teleprompter'
          }
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span className="hidden sm:inline">Start Teleprompter</span>
          <span className="sm:hidden">Prompt</span>
        </button>
      </div>
    </header>
  );
};
