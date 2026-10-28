import React from 'react';
import {
  X,
  RotateCcw,
  AlignLeft,
  AlignCenter,
  FlipHorizontal,
  FlipVertical,
  Eye,
  Play,
} from 'lucide-react';
import {
  PrompterFontFamily,
  PrompterThemePreset,
  TeleprompterSettings,
} from '../types/teleprompter';
import { DEFAULT_SETTINGS } from '../data/defaultScripts';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  settings: TeleprompterSettings;
  onUpdateSettings: (partial: Partial<TeleprompterSettings>) => void;
  onResetSettings: () => void;
  onStartTeleprompter: () => void;
  hasContent: boolean;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onResetSettings,
  onStartTeleprompter,
  hasContent,
}) => {
  if (!isOpen) return null;

  const fontOptions: { id: PrompterFontFamily; label: string }[] = [
    { id: 'sans', label: 'Sans-Serif' },
    { id: 'serif', label: 'Editorial Serif' },
    { id: 'mono', label: 'Monospace' },
  ];

  const surfaceOptions: {
    id: PrompterThemePreset;
    label: string;
    bgClass: string;
    textClass: string;
  }[] = [
    {
      id: 'pitch-black',
      label: 'Studio Black',
      bgClass: 'bg-[#0B0B0B]',
      textClass: 'text-[#FAF9F6]',
    },
    {
      id: 'deep-charcoal',
      label: 'Charcoal',
      bgClass: 'bg-[#171717]',
      textClass: 'text-[#FAF9F6]',
    },
    {
      id: 'warm-paper',
      label: 'Warm Off-White',
      bgClass: 'bg-[#FAF9F6]',
      textClass: 'text-[#171717]',
    },
    {
      id: 'high-contrast',
      label: 'High Contrast',
      bgClass: 'bg-[#0B0B0B]',
      textClass: 'text-[#FF8A32]',
    },
  ];

  const countdownOptions = [0, 3, 5, 10];

  const currentSurface =
    surfaceOptions.find((s) => s.id === settings.prompterTheme) ||
    surfaceOptions[0];

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-black/35 dark:bg-black/60 backdrop-blur-[1px]"
      onClick={onClose}
    >
      <aside
        aria-label="Teleprompter reading preferences"
        className="w-full max-w-md bg-[var(--bg-canvas)] border-l border-[var(--border-subtle)] h-full flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
          <div>
            <h2 className="text-base font-bold text-[var(--text-primary)]">
              Reading Preferences
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Customize your teleprompter stage and pacing
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onResetSettings}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-control)] cursor-pointer"
              title="Reset all reading preferences to default"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-control)] cursor-pointer"
              aria-label="Close reading preferences"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Preferences Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Live Stage Swatch Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
              <span>Live Stage Preview</span>
              <span className="font-mono tabular-nums">
                {settings.fontSize}px · {settings.wpm} WPM
              </span>
            </div>
            <div
              className={`relative h-28 rounded-xl border border-[var(--border-strong)] overflow-hidden flex items-center justify-center px-6 ${currentSurface.bgClass} ${currentSurface.textClass}`}
            >
              {settings.showReadingGuide && (
                <div
                  style={{ top: `${settings.readingGuidePosition}%` }}
                  className="absolute inset-x-0 h-9 -translate-y-1/2 border-y border-[#FF6A00]/45 bg-[#FF6A00]/10 pointer-events-none"
                />
              )}
              <p
                style={{
                  fontSize: `${Math.min(30, Math.max(16, Math.round(settings.fontSize * 0.45)))}px`,
                  lineHeight: settings.lineHeight,
                  textAlign: settings.textAlign,
                  transform: `scale(${settings.mirrorHorizontal ? -1 : 1}, ${
                    settings.mirrorVertical ? -1 : 1
                  })`,
                }}
                className={`w-full select-none truncate font-medium ${
                  settings.fontFamily === 'serif'
                    ? 'font-serif'
                    : settings.fontFamily === 'mono'
                    ? 'font-mono'
                    : 'font-sans'
                }`}
              >
                Speak with calm, unhurried clarity.
              </p>
            </div>
          </div>

          {/* 1. Reading Speed (WPM) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="setting-wpm"
                className="text-xs font-semibold text-[var(--text-primary)]"
              >
                Reading Speed (Words Per Minute)
              </label>
              <span className="text-xs font-mono tabular-nums font-semibold text-[#FF6A00] dark:text-[#FF8A32]">
                {settings.wpm} WPM
              </span>
            </div>
            <input
              id="setting-wpm"
              type="range"
              min={60}
              max={260}
              step={5}
              value={settings.wpm}
              onChange={(e) =>
                onUpdateSettings({ wpm: Number(e.target.value) })
              }
              className="w-full accent-[#FF6A00] cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-[var(--text-muted)] font-mono tabular-nums">
              <span>60 (Slow)</span>
              <span>130 (Default Pace)</span>
              <span>260 (Fast)</span>
            </div>
          </div>

          {/* 2. Teleprompter Font Size & Line Spacing */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="setting-font-size"
                  className="text-xs font-semibold text-[var(--text-primary)]"
                >
                  Stage Text Size
                </label>
                <span className="text-xs font-mono tabular-nums text-[var(--text-muted)]">
                  {settings.fontSize}px
                </span>
              </div>
              <input
                id="setting-font-size"
                type="range"
                min={28}
                max={96}
                step={2}
                value={settings.fontSize}
                onChange={(e) =>
                  onUpdateSettings({ fontSize: Number(e.target.value) })
                }
                className="w-full accent-[#FF6A00] cursor-pointer"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="setting-line-height"
                  className="text-xs font-semibold text-[var(--text-primary)]"
                >
                  Line Spacing
                </label>
                <span className="text-xs font-mono tabular-nums text-[var(--text-muted)]">
                  {settings.lineHeight.toFixed(2)}×
                </span>
              </div>
              <input
                id="setting-line-height"
                type="range"
                min={1.2}
                max={2.0}
                step={0.05}
                value={settings.lineHeight}
                onChange={(e) =>
                  onUpdateSettings({ lineHeight: Number(e.target.value) })
                }
                className="w-full accent-[#FF6A00] cursor-pointer"
              />
            </div>
          </div>

          {/* 3. Reading Column Width */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="setting-width"
                className="text-xs font-semibold text-[var(--text-primary)]"
              >
                Reading Column Width (Eye Scan Span)
              </label>
              <span className="text-xs font-mono tabular-nums text-[var(--text-muted)]">
                {settings.contentWidthPercent}%
              </span>
            </div>
            <input
              id="setting-width"
              type="range"
              min={45}
              max={92}
              step={1}
              value={settings.contentWidthPercent}
              onChange={(e) =>
                onUpdateSettings({
                  contentWidthPercent: Number(e.target.value),
                })
              }
              className="w-full accent-[#FF6A00] cursor-pointer"
            />
            <p className="text-[11px] text-[var(--text-muted)]">
              Narrower columns reduce horizontal eye movement on camera.
            </p>
          </div>

          {/* 4. Typography & Alignment */}
          <div className="space-y-3 pt-2 border-t border-[var(--border-subtle)]">
            <div className="text-xs font-semibold text-[var(--text-primary)]">
              Typography & Alignment
            </div>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-[var(--bg-control)] rounded-lg">
              {fontOptions.map((font) => (
                <button
                  key={font.id}
                  type="button"
                  onClick={() => onUpdateSettings({ fontFamily: font.id })}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 cursor-pointer ${
                    settings.fontFamily === font.id
                      ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-2xs'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {font.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-1.5 p-1 bg-[var(--bg-control)] rounded-lg">
              <button
                type="button"
                onClick={() => onUpdateSettings({ textAlign: 'left' })}
                className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 cursor-pointer ${
                  settings.textAlign === 'left'
                    ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-2xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                <AlignLeft className="w-3.5 h-3.5" />
                <span>Left Aligned</span>
              </button>
              <button
                type="button"
                onClick={() => onUpdateSettings({ textAlign: 'center' })}
                className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 cursor-pointer ${
                  settings.textAlign === 'center'
                    ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-2xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                <AlignCenter className="w-3.5 h-3.5" />
                <span>Centered</span>
              </button>
            </div>
          </div>

          {/* 5. Teleprompter Stage Surface */}
          <div className="space-y-2.5 pt-2 border-t border-[var(--border-subtle)]">
            <div className="text-xs font-semibold text-[var(--text-primary)]">
              Teleprompter Stage Surface
            </div>
            <div className="grid grid-cols-2 gap-2">
              {surfaceOptions.map((surface) => (
                <button
                  key={surface.id}
                  type="button"
                  onClick={() =>
                    onUpdateSettings({ prompterTheme: surface.id })
                  }
                  className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-xs font-medium cursor-pointer ${
                    settings.prompterTheme === surface.id
                      ? 'border-[#FF6A00] bg-[#FF6A00]/10 text-[var(--text-primary)]'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full border border-[var(--border-strong)] shrink-0 ${surface.bgClass}`}
                  />
                  <span className="truncate">{surface.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 6. Eye-Line Focus Guide & Mirror Mode */}
          <div className="space-y-3 pt-2 border-t border-[var(--border-subtle)]">
            <div className="text-xs font-semibold text-[var(--text-primary)]">
              Optics, Mirroring & Eye-Line Guide
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({
                    mirrorHorizontal: !settings.mirrorHorizontal,
                  })
                }
                className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium cursor-pointer ${
                  settings.mirrorHorizontal
                    ? 'border-[#FF6A00] bg-[#FF6A00]/10 text-[#FF6A00] dark:text-[#FF8A32]'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-control)]'
                }`}
              >
                <FlipHorizontal className="w-3.5 h-3.5" />
                <span>Mirror Horizontal</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({
                    mirrorVertical: !settings.mirrorVertical,
                  })
                }
                className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium cursor-pointer ${
                  settings.mirrorVertical
                    ? 'border-[#FF6A00] bg-[#FF6A00]/10 text-[#FF6A00] dark:text-[#FF8A32]'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-control)]'
                }`}
              >
                <FlipVertical className="w-3.5 h-3.5" />
                <span>Flip Vertical</span>
              </button>
            </div>

            <label className="flex items-center justify-between gap-3 py-1 cursor-pointer">
              <span className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                <Eye className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                <span>Show eye-line reading focus band</span>
              </span>
              <input
                type="checkbox"
                checked={settings.showReadingGuide}
                onChange={(e) =>
                  onUpdateSettings({ showReadingGuide: e.target.checked })
                }
                className="rounded accent-[#FF6A00] w-4 h-4 cursor-pointer"
              />
            </label>

            {settings.showReadingGuide && (
              <div className="space-y-2 pl-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--text-muted)]">
                    Eye-Line Vertical Position
                  </span>
                  <span className="text-xs font-mono tabular-nums text-[var(--text-muted)]">
                    {settings.readingGuidePosition}% from top
                  </span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={60}
                  step={2}
                  value={settings.readingGuidePosition}
                  onChange={(e) =>
                    onUpdateSettings({
                      readingGuidePosition: Number(e.target.value),
                    })
                  }
                  className="w-full accent-[#FF6A00] cursor-pointer"
                />

                <label className="flex items-center justify-between gap-3 pt-1 cursor-pointer">
                  <span className="text-xs text-[var(--text-muted)]">
                    Dim text outside active focus zone
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.dimSurroundingText}
                    onChange={(e) =>
                      onUpdateSettings({ dimSurroundingText: e.target.checked })
                    }
                    className="rounded accent-[#FF6A00] w-4 h-4 cursor-pointer"
                  />
                </label>
              </div>
            )}
          </div>

          {/* 7. Studio Timing & Cues */}
          <div className="space-y-3 pt-2 border-t border-[var(--border-subtle)]">
            <div className="text-xs font-semibold text-[var(--text-primary)]">
              Countdown & Smart Cues
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-[var(--text-muted)]">
                Start Countdown
              </span>
              <div className="flex items-center gap-1 p-1 bg-[var(--bg-control)] rounded-lg">
                {countdownOptions.map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() =>
                      onUpdateSettings({ countdownSeconds: sec })
                    }
                    className={`px-2.5 py-1 text-xs font-mono tabular-nums font-medium rounded cursor-pointer ${
                      settings.countdownSeconds === sec
                        ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-2xs'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {sec === 0 ? 'Off' : `${sec}s`}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center justify-between gap-3 py-1 cursor-pointer">
              <span className="text-xs text-[var(--text-secondary)]">
                Auto-pause scrolling at <code className="font-mono">[PAUSE Xs]</code> cues
              </span>
              <input
                type="checkbox"
                checked={settings.honorPauseCues}
                onChange={(e) =>
                  onUpdateSettings({ honorPauseCues: e.target.checked })
                }
                className="rounded accent-[#FF6A00] w-4 h-4 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between gap-3 py-1 cursor-pointer">
              <span className="text-xs text-[var(--text-secondary)]">
                Auto-loop script when reaching the end
              </span>
              <input
                type="checkbox"
                checked={settings.autoLoop}
                onChange={(e) =>
                  onUpdateSettings({ autoLoop: e.target.checked })
                }
                className="rounded accent-[#FF6A00] w-4 h-4 cursor-pointer"
              />
            </label>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="px-6 py-4 border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onUpdateSettings(DEFAULT_SETTINGS)}
            className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
          >
            Restore Defaults
          </button>
          <button
            type="button"
            disabled={!hasContent}
            onClick={() => {
              onClose();
              onStartTeleprompter();
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-[#FF6A00] hover:bg-[#E65F00] text-white disabled:opacity-40 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Start Teleprompter</span>
          </button>
        </div>
      </aside>
    </div>
  );
};
