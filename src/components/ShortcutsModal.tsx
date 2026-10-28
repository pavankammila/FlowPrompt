import React from 'react';
import { X, Keyboard } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const teleprompterShortcuts = [
    { key: 'Space', action: 'Play / Pause scrolling' },
    { key: '↑ / ↓', action: 'Increase / Decrease reading speed (±5 WPM)' },
    { key: '+ / -', action: 'Increase / Decrease stage font size' },
    { key: 'R', action: 'Restart script from the top' },
    { key: 'M / V', action: 'Toggle horizontal / vertical mirror mode' },
    { key: 'G', action: 'Toggle eye-line reading focus guide' },
    { key: 'C', action: 'Toggle presenter camera eye-line preview' },
    { key: 'F', action: 'Toggle native browser fullscreen' },
    { key: '?', action: 'Show in-prompter shortcuts cheat sheet' },
    { key: 'Esc', action: 'Exit teleprompter back to script editor' },
  ];

  const editorShortcuts = [
    { key: 'Cmd/Ctrl + Enter', action: 'Start Teleprompter immediately' },
    { key: 'Cmd/Ctrl + Z', action: 'Undo script edit' },
    { key: 'Cmd/Ctrl + Shift + Z', action: 'Redo script edit' },
    { key: 'Cmd/Ctrl + ,', action: 'Open / Close Reading Preferences' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-modal-title"
        className="w-full max-w-lg rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-[#FF6A00] dark:text-[#FF8A32]" />
            <h2
              id="shortcuts-modal-title"
              className="text-base font-bold text-[var(--text-primary)]"
            >
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-control)] cursor-pointer"
            aria-label="Close keyboard shortcuts"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          <div>
            <h3 className="text-xs font-semibold text-[var(--text-muted)] mb-3">
              Teleprompter Stage Controls
            </h3>
            <div className="divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)]">
              {teleprompterShortcuts.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between py-2.5 text-xs"
                >
                  <span className="text-[var(--text-secondary)]">
                    {item.action}
                  </span>
                  <kbd className="px-2 py-1 rounded bg-[var(--bg-elevated)] border border-[var(--border-strong)] font-mono text-[var(--text-primary)]">
                    {item.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-[var(--text-muted)] mb-3">
              Editor Workspace
            </h3>
            <div className="divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)]">
              {editorShortcuts.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between py-2.5 text-xs"
                >
                  <span className="text-[var(--text-secondary)]">
                    {item.action}
                  </span>
                  <kbd className="px-2 py-1 rounded bg-[var(--bg-elevated)] border border-[var(--border-strong)] font-mono text-[var(--text-primary)]">
                    {item.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
