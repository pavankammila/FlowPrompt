import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Minus,
  Plus,
  FlipHorizontal,
  FlipVertical,
  Eye,
  Maximize2,
  Minimize2,
  ArrowLeft,
  Video,
  VideoOff,
  ChevronRight,
  ChevronLeft,
  SlidersHorizontal,
  Keyboard,
  X,
  AlignLeft,
  AlignCenter,
  CheckCircle2,
  Sun,
  Moon,
} from 'lucide-react';
import {
  PrompterFontFamily,
  PrompterThemePreset,
  ScriptStats,
  TeleprompterSettings,
  ThemeMode,
} from '../types/teleprompter';
import {
  formatClockTimer,
  parseScriptLines,
  ParsedScriptLine,
} from '../utils/scriptMetrics';
import { FlowPromptLogo } from './FlowPromptLogo';

interface TeleprompterViewProps {
  scriptTitle: string;
  content: string;
  settings: TeleprompterSettings;
  stats: ScriptStats;
  theme?: ThemeMode;
  onToggleTheme?: () => void;
  onUpdateSettings: (partial: Partial<TeleprompterSettings>) => void;
  onExit: () => void;
}

export const TeleprompterView: React.FC<TeleprompterViewProps> = ({
  scriptTitle,
  content,
  settings,
  stats,
  theme = 'dark',
  onToggleTheme,
  onUpdateSettings,
  onExit,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [countdownRemaining, setCountdownRemaining] = useState<number>(
    settings.countdownSeconds
  );
  const [activePauseCueRemaining, setActivePauseCueRemaining] = useState<
    number | null
  >(null);
  const [progress, setProgress] = useState(0); // 0 to 1
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [hudVisible, setHudVisible] = useState(true);
  const [isComplete, setIsComplete] = useState(false);
  const [showQuickSettings, setShowQuickSettings] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  const stageRootRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const lineRefs = useRef<Map<string, HTMLElement>>(new Map());
  const triggeredCuesRef = useRef<Set<string>>(new Set());

  // Sub-pixel scroll position accumulator for silky-smooth 60fps scrolling
  const scrollPosRef = useRef<number>(0);
  const progressRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const hudTimeoutRef = useRef<number | null>(null);
  const countdownTimerRef = useRef<number | null>(null);
  const isManualScrollingRef = useRef<boolean>(false);
  const manualScrollTimerRef = useRef<number | null>(null);

  // Prevent background page from scrolling while teleprompter is mounted
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const parsedLines: ParsedScriptLine[] = useMemo(
    () => parseScriptLines(content),
    [content]
  );

  // Surface color classes based on prompterTheme preset
  const surfaceConfig = useMemo(() => {
    switch (settings.prompterTheme) {
      case 'deep-charcoal':
        return {
          bg: 'bg-[#171717]',
          text: 'text-[#FAF9F6]',
          heading: 'text-[#FF8A32]',
          cue: 'text-[#FF8A32] border-[#FF6A00]/35 bg-[#FF6A00]/10',
          guideBorder: 'border-[#FF6A00]/40 bg-[#FF6A00]/[0.05]',
          scrimFrom: 'from-[#171717]/90',
        };
      case 'warm-paper':
        return {
          bg: 'bg-[#FAF9F6]',
          text: 'text-[#171717]',
          heading: 'text-[#FF6A00]',
          cue: 'text-[#171717] border-[#FF6A00]/40 bg-[#FF6A00]/10',
          guideBorder: 'border-[#FF6A00]/35 bg-[#FF6A00]/[0.04]',
          scrimFrom: 'from-[#FAF9F6]/90',
        };
      case 'high-contrast':
        return {
          bg: 'bg-black',
          text: 'text-[#FF8A32]',
          heading: 'text-white',
          cue: 'text-white border-[#FF8A32]/50 bg-[#FF6A00]/15',
          guideBorder: 'border-[#FF8A32]/50 bg-[#FF8A32]/[0.06]',
          scrimFrom: 'from-black/95',
        };
      case 'pitch-black':
      default:
        return {
          bg: 'bg-[#0D0D0D]',
          text: 'text-[#FFFFFF]',
          heading: 'text-[#FF8A32]',
          cue: 'text-[#FF8A32] border-[#FF6A00]/35 bg-[#FF6A00]/10',
          guideBorder: 'border-[#FF6A00]/40 bg-[#FF6A00]/[0.05]',
          scrimFrom: 'from-[#0D0D0D]/90',
        };
    }
  }, [settings.prompterTheme]);

  // Initial countdown timer before playback starts
  useEffect(() => {
    if (settings.countdownSeconds <= 0) {
      setCountdownRemaining(0);
      setIsPlaying(true);
      return;
    }

    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
    }

    setCountdownRemaining(settings.countdownSeconds);
    countdownTimerRef.current = window.setInterval(() => {
      setCountdownRemaining((prev) => {
        if (prev <= 1) {
          if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
          }
          setIsPlaying(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
    };
  }, [settings.countdownSeconds]);

  // Elapsed speaking timer when playing
  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isPlaying]);

  // Handle active [PAUSE Xs] cue countdown
  useEffect(() => {
    if (activePauseCueRemaining === null) return;
    if (activePauseCueRemaining <= 0) {
      setActivePauseCueRemaining(null);
      setIsPlaying(true);
      return;
    }

    const timer = window.setTimeout(() => {
      setActivePauseCueRemaining((prev) =>
        prev !== null ? Math.max(0, Number((prev - 0.1).toFixed(1))) : null
      );
    }, 100);

    return () => window.clearTimeout(timer);
  }, [activePauseCueRemaining]);

  // Restart teleprompter from top
  const handleRestart = useCallback(
    (triggerCountdown = true) => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
      const container = scrollContainerRef.current;
      if (container) {
        container.scrollTop = 0;
      }
      scrollPosRef.current = 0;
      progressRef.current = 0;
      lastFrameTimeRef.current = null;
      triggeredCuesRef.current.clear();
      setActivePauseCueRemaining(null);
      setIsComplete(false);
      setProgress(0);
      setElapsedSeconds(0);

      if (triggerCountdown && settings.countdownSeconds > 0) {
        setIsPlaying(false);
        setCountdownRemaining(settings.countdownSeconds);
      } else {
        setCountdownRemaining(0);
        setIsPlaying(true);
      }
    },
    [settings.countdownSeconds]
  );

  // Reset position to top without resetting elapsed timer or triggering countdown
  const handleResetPosition = useCallback(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollTop = 0;
    }
    scrollPosRef.current = 0;
    progressRef.current = 0;
    lastFrameTimeRef.current = null;
    triggeredCuesRef.current.clear();
    setActivePauseCueRemaining(null);
    setIsComplete(false);
    setProgress(0);
  }, []);

  // Safe scroll recalculation when layout (font size, margins, line height) changes:
  // Preserves user's exact relative position without jumping or jitter!
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const maxScroll = Math.max(
      1,
      container.scrollHeight - container.clientHeight
    );
    const targetScroll = progressRef.current * maxScroll;
    scrollPosRef.current = targetScroll;
    container.scrollTop = targetScroll;
  }, [
    settings.fontSize,
    settings.lineHeight,
    settings.contentWidthPercent,
    settings.fontFamily,
    settings.textAlign,
  ]);

  // Window resize observer to smoothly maintain position
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleResize = () => {
      if (isManualScrollingRef.current) return;
      const maxScroll = Math.max(
        1,
        container.scrollHeight - container.clientHeight
      );
      const targetScroll = progressRef.current * maxScroll;
      scrollPosRef.current = targetScroll;
      container.scrollTop = targetScroll;
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Main 60fps requestAnimationFrame auto-scroll loop
  useEffect(() => {
    if (!isPlaying || activePauseCueRemaining !== null || isComplete) {
      lastFrameTimeRef.current = null;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      return;
    }

    const step = (timestamp: number) => {
      const container = scrollContainerRef.current;
      if (!container) return;

      if (lastFrameTimeRef.current === null) {
        lastFrameTimeRef.current = timestamp;
        scrollPosRef.current = container.scrollTop;
      }

      // Cap delta time to prevent giant leaps if tab loses focus
      const deltaSeconds = Math.min(
        0.1,
        (timestamp - lastFrameTimeRef.current) / 1000
      );
      lastFrameTimeRef.current = timestamp;

      const maxScroll = Math.max(
        1,
        container.scrollHeight - container.clientHeight
      );

      // Compute spoken duration in seconds from word count & WPM
      const spokenDurationSeconds = Math.max(
        6,
        (Math.max(12, stats.words) / Math.max(40, settings.wpm)) * 60
      );

      // Velocity in pixels per second
      const pixelsPerSecond = maxScroll / spokenDurationSeconds;

      scrollPosRef.current = Math.min(
        maxScroll,
        scrollPosRef.current + pixelsPerSecond * deltaSeconds
      );

      container.scrollTop = scrollPosRef.current;
      const nextProgress = Math.min(1, scrollPosRef.current / maxScroll);
      progressRef.current = nextProgress;
      setProgress(nextProgress);

      // Check if any [PAUSE Xs] cue has crossed the reading guide line
      if (settings.honorPauseCues) {
        const guideY =
          container.getBoundingClientRect().top +
          (container.clientHeight * settings.readingGuidePosition) / 100;

        for (const line of parsedLines) {
          if (
            line.type === 'cue-pause' &&
            line.pauseSeconds &&
            !triggeredCuesRef.current.has(line.id)
          ) {
            const el = lineRefs.current.get(line.id);
            if (el) {
              const rect = el.getBoundingClientRect();
              const elementCenterY = rect.top + rect.height / 2;
              if (Math.abs(elementCenterY - guideY) < 28) {
                triggeredCuesRef.current.add(line.id);
                setIsPlaying(false);
                setActivePauseCueRemaining(line.pauseSeconds);
                return;
              }
            }
          }
        }
      }

      // Check if reached the bottom of the script
      if (scrollPosRef.current >= maxScroll - 0.5) {
        if (settings.autoLoop) {
          handleRestart(false);
        } else {
          setIsPlaying(false);
          setIsComplete(true);
          return;
        }
      }

      animFrameRef.current = window.requestAnimationFrame(step);
    };

    animFrameRef.current = window.requestAnimationFrame(step);
    return () => {
      if (animFrameRef.current) {
        window.cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [
    isPlaying,
    activePauseCueRemaining,
    isComplete,
    settings.wpm,
    settings.honorPauseCues,
    settings.readingGuidePosition,
    settings.autoLoop,
    stats.words,
    parsedLines,
    handleRestart,
  ]);

  // Sync manual user scroll (wheel / touch drag / scrollbar) seamlessly
  const handleManualScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const maxScroll = Math.max(
      1,
      container.scrollHeight - container.clientHeight
    );

    isManualScrollingRef.current = true;
    if (manualScrollTimerRef.current) {
      window.clearTimeout(manualScrollTimerRef.current);
    }
    manualScrollTimerRef.current = window.setTimeout(() => {
      isManualScrollingRef.current = false;
    }, 150);

    scrollPosRef.current = container.scrollTop;
    const nextProg = Math.min(1, container.scrollTop / maxScroll);
    progressRef.current = nextProg;
    setProgress(nextProg);

    if (isComplete && container.scrollTop < maxScroll - 20) {
      setIsComplete(false);
    }
  };

  // Toggle Fullscreen
  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await stageRootRef.current?.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      // Ignore iframe permission restrictions
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Optional Presenter Camera Eye-Line Preview
  const toggleCamera = useCallback(async () => {
    if (isCameraEnabled) {
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
      setIsCameraEnabled(false);
      setCameraError(null);
      return;
    }

    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 360 },
          facingMode: 'user',
        },
        audio: false,
      });
      mediaStreamRef.current = stream;
      setIsCameraEnabled(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setCameraError('Camera access unavailable or blocked');
      setIsCameraEnabled(false);
    }
  }, [isCameraEnabled]);

  useEffect(() => {
    if (isCameraEnabled && videoRef.current && mediaStreamRef.current) {
      videoRef.current.srcObject = mediaStreamRef.current;
    }
  }, [isCameraEnabled]);

  useEffect(() => {
    return () => {
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Auto-hide HUD on user inactivity during playback
  const revealHudTemporarily = useCallback(() => {
    setHudVisible(true);
    if (hudTimeoutRef.current) {
      window.clearTimeout(hudTimeoutRef.current);
    }
    hudTimeoutRef.current = window.setTimeout(() => {
      if (isPlaying && !showQuickSettings && !showShortcutsModal) {
        setHudVisible(false);
      }
    }, 3400);
  }, [isPlaying, showQuickSettings, showShortcutsModal]);

  useEffect(() => {
    if (!isPlaying || showQuickSettings || showShortcutsModal) {
      setHudVisible(true);
    } else {
      revealHudTemporarily();
    }
  }, [isPlaying, showQuickSettings, showShortcutsModal, revealHudTemporarily]);

  // Keyboard shortcuts inside TeleprompterView
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      revealHudTemporarily();

      if (e.code === 'Space') {
        e.preventDefault();
        if (isComplete) {
          handleRestart(false);
        } else if (countdownRemaining > 0) {
          if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
          }
          setCountdownRemaining(0);
          setIsPlaying(true);
        } else if (activePauseCueRemaining !== null) {
          setActivePauseCueRemaining(null);
          setIsPlaying(true);
        } else {
          setIsPlaying((prev) => !prev);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        onUpdateSettings({ wpm: Math.min(260, settings.wpm + 5) });
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        onUpdateSettings({ wpm: Math.max(60, settings.wpm - 5) });
      } else if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        onUpdateSettings({ fontSize: Math.min(96, settings.fontSize + 4) });
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        onUpdateSettings({ fontSize: Math.max(28, settings.fontSize - 4) });
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        handleRestart(true);
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        onUpdateSettings({ mirrorHorizontal: !settings.mirrorHorizontal });
      } else if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        onUpdateSettings({ mirrorVertical: !settings.mirrorVertical });
      } else if (e.key === 'g' || e.key === 'G') {
        e.preventDefault();
        onUpdateSettings({ showReadingGuide: !settings.showReadingGuide });
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        toggleCamera();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setShowShortcutsModal((prev) => !prev);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (showQuickSettings) {
          setShowQuickSettings(false);
          return;
        }
        if (showShortcutsModal) {
          setShowShortcutsModal(false);
          return;
        }
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
        onExit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    countdownRemaining,
    activePauseCueRemaining,
    isComplete,
    settings,
    showQuickSettings,
    showShortcutsModal,
    onUpdateSettings,
    handleRestart,
    toggleCamera,
    toggleFullscreen,
    onExit,
    revealHudTemporarily,
  ]);

  const remainingSeconds = Math.max(
    0,
    Math.round(stats.estimatedSeconds * (1 - progress))
  );

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    const container = scrollContainerRef.current;
    if (!container) return;
    const maxScroll = Math.max(
      1,
      container.scrollHeight - container.clientHeight
    );
    const prevProg = progressRef.current;
    const nextScroll = val * maxScroll;
    scrollPosRef.current = nextScroll;
    progressRef.current = val;
    container.scrollTop = nextScroll;
    setProgress(val);
    lastFrameTimeRef.current = null;
    if (val < prevProg) {
      // Allow cues ahead of the new position to fire again
      triggeredCuesRef.current.clear();
    }
    if (isComplete && val < 0.98) {
      setIsComplete(false);
    }
  };

  const fontOptions: { id: PrompterFontFamily; label: string }[] = [
    { id: 'sans', label: 'Sans' },
    { id: 'serif', label: 'Serif' },
    { id: 'mono', label: 'Mono' },
  ];

  const surfaceOptions: {
    id: PrompterThemePreset;
    label: string;
    bgClass: string;
  }[] = [
    { id: 'pitch-black', label: 'Studio Black', bgClass: 'bg-[#0D0D0D]' },
    { id: 'deep-charcoal', label: 'Charcoal', bgClass: 'bg-[#171717]' },
    { id: 'warm-paper', label: 'Warm Paper', bgClass: 'bg-[#FAF9F6]' },
    { id: 'high-contrast', label: 'High Contrast', bgClass: 'bg-black' },
  ];

  const isLightStage = settings.prompterTheme === 'warm-paper';

  const handleToggleStageTheme = () => {
    if (onToggleTheme) {
      onToggleTheme();
    }
    onUpdateSettings({
      prompterTheme: isLightStage ? 'deep-charcoal' : 'warm-paper',
    });
  };

  return (
    <div
      ref={stageRootRef}
      onMouseMove={revealHudTemporarily}
      onTouchStart={revealHudTemporarily}
      className={`fixed inset-0 z-50 flex flex-col select-none overflow-hidden transition-colors duration-200 ${surfaceConfig.bg} ${surfaceConfig.text}`}
    >
      {/* Top Header Bar & Interactive Timeline Scrubber */}
      <header
        className={`relative z-30 flex items-center justify-between gap-3 sm:gap-6 px-4 sm:px-6 h-14 border-b transition-opacity duration-200 ${
          isLightStage
            ? 'border-[#171717]/10 bg-[#FAF9F6]/85 text-[#171717]'
            : 'border-white/10 bg-[#171717]/80 text-[#FAF9F6]'
        } backdrop-blur-md ${
          hudVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onExit}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              isLightStage
                ? 'text-[#171717] bg-[#171717]/8 hover:bg-[#171717]/15'
                : 'text-zinc-200 hover:text-white bg-white/10 hover:bg-white/15'
            }`}
            title="Exit to Script Editor (Esc)"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Exit</span>
          </button>

          <FlowPromptLogo variant="icon" size={20} className="hidden sm:inline-flex" />

          <span className="text-xs font-semibold truncate max-w-[140px] sm:max-w-xs">
            {scriptTitle}
          </span>
        </div>

        {/* Timeline Progress Scrubber with Time Remaining */}
        <div className="flex items-center gap-2.5 flex-1 max-w-sm sm:max-w-md mx-auto">
          <span className="text-xs font-mono tabular-nums opacity-70 w-10 text-right">
            {Math.round(progress * 100)}%
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={progress}
            onChange={handleScrub}
            aria-label="Script progress scrubber"
            className="w-full accent-[#FF6A00] cursor-pointer"
          />
          <span className="text-xs font-mono tabular-nums opacity-80 whitespace-nowrap">
            -{formatClockTimer(remainingSeconds)}
          </span>
        </div>

        {/* Right Top Status & Quick Triggers */}
        <div className="flex items-center gap-2 sm:gap-3 text-xs font-mono tabular-nums whitespace-nowrap shrink-0">
          <span className="hidden md:inline opacity-75">
            Elapsed {formatClockTimer(elapsedSeconds)}
          </span>

          {/* Stage Theme Switcher (Warm Paper / Charcoal) */}
          <button
            type="button"
            onClick={handleToggleStageTheme}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isLightStage
                ? 'text-[#171717]/75 hover:text-[#171717] hover:bg-[#171717]/10'
                : 'text-zinc-300 hover:text-white hover:bg-white/10'
            }`}
            title={
              isLightStage
                ? 'Switch to Charcoal Dark Stage'
                : 'Switch to Warm Off-White Stage'
            }
            aria-label="Toggle stage theme"
          >
            {isLightStage ? (
              <Moon className="w-4 h-4" />
            ) : (
              <Sun className="w-4 h-4 text-[#FF8A32]" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowShortcutsModal(true)}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isLightStage
                ? 'text-[#171717]/75 hover:text-[#171717] hover:bg-[#171717]/10'
                : 'text-zinc-300 hover:text-white hover:bg-white/10'
            }`}
            title="Keyboard Shortcuts (?)"
            aria-label="Keyboard Shortcuts"
          >
            <Keyboard className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Optional Top-Center Presenter Camera Eye-Line Mirror */}
      {isCameraEnabled && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center">
          <div className="relative w-44 sm:w-56 aspect-video rounded-xl overflow-hidden border border-white/25 shadow-2xl bg-[#171717]">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover -scale-x-100"
            />
            <div className="absolute inset-x-0 bottom-0 px-2.5 py-1 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between text-[10px] text-zinc-200 font-mono">
              <span>Eye-Line Anchor</span>
              <button
                type="button"
                onClick={toggleCamera}
                className="text-zinc-300 hover:text-white underline cursor-pointer"
              >
                Hide
              </button>
            </div>
          </div>
        </div>
      )}

      {cameraError && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 px-3.5 py-1.5 rounded-lg bg-red-950/90 border border-red-500/40 text-xs text-red-200">
          {cameraError}
        </div>
      )}

      {/* Eye-Line Reading Focus Band Overlay */}
      {settings.showReadingGuide && (
        <div
          style={{ top: `${settings.readingGuidePosition}%` }}
          className={`pointer-events-none fixed inset-x-0 z-20 -translate-y-1/2 h-24 sm:h-32 border-y ${surfaceConfig.guideBorder} flex items-center justify-between px-3 sm:px-6 transition-all`}
        >
          <ChevronRight className="w-6 h-6 text-[#FF6A00] shrink-0" />
          <ChevronLeft className="w-6 h-6 text-[#FF6A00] shrink-0" />
        </div>
      )}

      {/* Optional Dimming Scrims Above & Below Active Eye-Line Zone */}
      {settings.showReadingGuide && settings.dimSurroundingText && (
        <>
          <div
            style={{
              height: `calc(${settings.readingGuidePosition}% - 4rem)`,
            }}
            className={`pointer-events-none fixed top-0 inset-x-0 z-10 bg-gradient-to-b ${surfaceConfig.scrimFrom} to-transparent`}
          />
          <div
            style={{
              top: `calc(${settings.readingGuidePosition}% + 4rem)`,
            }}
            className={`pointer-events-none fixed bottom-0 inset-x-0 z-10 bg-gradient-to-t ${surfaceConfig.scrimFrom} to-transparent`}
          />
        </>
      )}

      {/* Countdown Overlay before start */}
      {countdownRemaining > 0 && (
        <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-[#171717]/85 backdrop-blur-xs">
          <p className="text-xs font-medium text-zinc-400 mb-2">
            Position your eyes on the reading guide
          </p>
          <div className="text-7xl sm:text-9xl font-bold font-mono tabular-nums text-[#FF6A00] mb-6">
            {countdownRemaining}
          </div>
          <button
            type="button"
            onClick={() => {
              if (countdownTimerRef.current) {
                clearInterval(countdownTimerRef.current);
                countdownTimerRef.current = null;
              }
              setCountdownRemaining(0);
              setIsPlaying(true);
            }}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#FF6A00] hover:bg-[#FF8A32] text-white transition-colors shadow-lg cursor-pointer"
          >
            Start Immediately (Space)
          </button>
        </div>
      )}

      {/* Active [PAUSE Xs] Cue Countdown Indicator */}
      {activePauseCueRemaining !== null && (
        <div className="fixed top-20 right-6 z-40 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[#FF6A00]/20 border border-[#FF8A32]/40 backdrop-blur-md text-[#FF8A32] shadow-xl">
          <span className="text-xs font-mono tabular-nums font-semibold">
            Pause: {activePauseCueRemaining.toFixed(1)}s
          </span>
          <button
            type="button"
            onClick={() => {
              setActivePauseCueRemaining(null);
              setIsPlaying(true);
            }}
            className="text-xs underline hover:text-white cursor-pointer font-medium"
          >
            Resume (Space)
          </button>
        </div>
      )}

      {/* Script Complete Overlay */}
      {isComplete && (
        <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="max-w-md w-full p-6 sm:p-8 rounded-2xl bg-[#171717] border border-white/15 text-center shadow-2xl">
            <CheckCircle2 className="w-12 h-12 text-[#FF6A00] mx-auto mb-3" />
            <h2 className="text-xl font-bold text-[#FAF9F6] mb-1">
              Script Complete
            </h2>
            <p className="text-xs text-[#A39E96] mb-6 font-mono tabular-nums">
              Delivered in {formatClockTimer(elapsedSeconds)} · {settings.wpm} WPM
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => handleRestart(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#FF6A00] hover:bg-[#FF8A32] text-white transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Replay from Top (R)</span>
              </button>
              <button
                type="button"
                onClick={onExit}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-medium border border-white/15 hover:bg-[#242424] text-[#FAF9F6] transition-colors cursor-pointer"
              >
                <span>Back to Editor (Esc)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Scrolling Teleprompter Stage */}
      <main
        ref={scrollContainerRef}
        onScroll={handleManualScroll}
        onClick={() => {
          if (countdownRemaining === 0 && !isComplete) {
            setIsPlaying((prev) => !prev);
          }
        }}
        className="flex-1 overflow-y-auto no-scrollbar cursor-pointer overscroll-none"
      >
        <div
          style={{
            maxWidth: `${settings.contentWidthPercent}%`,
            paddingTop: `${settings.readingGuidePosition}vh`,
            paddingBottom: '68vh',
            transform: `scale(${settings.mirrorHorizontal ? -1 : 1}, ${
              settings.mirrorVertical ? -1 : 1
            })`,
          }}
          className={`mx-auto px-4 sm:px-8 transition-[max-width,padding] duration-150 ${
            settings.fontFamily === 'serif'
              ? 'font-serif'
              : settings.fontFamily === 'mono'
              ? 'font-mono'
              : 'font-sans'
          }`}
        >
          {parsedLines.map((line) => {
            if (line.type === 'spacer') {
              return (
                <div
                  key={line.id}
                  style={{ height: `${Math.round(settings.fontSize * 0.85)}px` }}
                  aria-hidden="true"
                />
              );
            }

            if (line.type === 'heading') {
              return (
                <h2
                  key={line.id}
                  ref={(el) => {
                    if (el) lineRefs.current.set(line.id, el);
                  }}
                  style={{
                    fontSize: `${Math.round(settings.fontSize * 0.72)}px`,
                    textAlign: settings.textAlign,
                  }}
                  className={`font-bold tracking-tight mt-12 mb-6 whitespace-pre-wrap break-words ${surfaceConfig.heading}`}
                >
                  {line.text}
                </h2>
              );
            }

            if (line.type === 'cue-pause' || line.type === 'cue-direction') {
              return (
                <div
                  key={line.id}
                  ref={(el) => {
                    if (el) lineRefs.current.set(line.id, el);
                  }}
                  style={{
                    textAlign: settings.textAlign,
                  }}
                  className="my-8"
                >
                  <span
                    style={{
                      fontSize: `${Math.max(16, Math.round(settings.fontSize * 0.42))}px`,
                    }}
                    className={`inline-block font-mono font-medium px-3.5 py-1 rounded-lg border ${surfaceConfig.cue}`}
                  >
                    {line.type === 'cue-pause'
                      ? `⏱ ${line.text}`
                      : `• ${line.text}`}
                  </span>
                </div>
              );
            }

            return (
              <p
                key={line.id}
                ref={(el) => {
                  if (el) lineRefs.current.set(line.id, el);
                }}
                style={{
                  fontSize: `${settings.fontSize}px`,
                  lineHeight: settings.lineHeight,
                  textAlign: settings.textAlign,
                }}
                className="font-medium tracking-[0.01em] mb-10 whitespace-pre-wrap break-words"
              >
                {line.text}
              </p>
            );
          })}
        </div>
      </main>

      {/* Bottom Floating Studio HUD Control Bar */}
      <footer
        onClick={(e) => e.stopPropagation()}
        className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-30 max-w-[95vw] transition-all duration-200 ${
          hudVisible
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-3 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-2 sm:gap-3 px-3.5 sm:px-4 py-2.5 rounded-2xl bg-[#171717]/95 text-[#FAF9F6] border border-white/15 shadow-2xl backdrop-blur-md overflow-x-auto no-scrollbar">
          {/* Play / Pause Primary Button */}
          <button
            type="button"
            onClick={() => {
              if (isComplete) {
                handleRestart(false);
              } else if (activePauseCueRemaining !== null) {
                setActivePauseCueRemaining(null);
                setIsPlaying(true);
              } else {
                setIsPlaying((prev) => !prev);
              }
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-[#FF6A00] hover:bg-[#FF8A32] text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-sm"
            title="Play or Pause (Space)"
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Play</span>
              </>
            )}
          </button>

          {/* Restart from Top Button */}
          <button
            type="button"
            onClick={() => handleRestart(true)}
            className="p-2 rounded-xl text-zinc-300 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
            title="Restart script from top (R)"
            aria-label="Restart script from top"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Reset Position Button */}
          <button
            type="button"
            onClick={handleResetPosition}
            className="hidden sm:inline-flex px-2 py-1.5 rounded-lg text-xs text-zinc-300 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            title="Reset position to top without countdown"
          >
            Top
          </button>

          <span aria-hidden="true" className="h-5 w-px bg-white/15 shrink-0" />

          {/* Speed Adjuster (WPM Slider + Step Buttons) */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() =>
                onUpdateSettings({ wpm: Math.max(60, settings.wpm - 5) })
              }
              className="p-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Slower (-5 WPM / Down Arrow)"
              aria-label="Decrease reading speed"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <div className="px-1.5 text-center font-mono tabular-nums text-xs">
              <span className="font-semibold text-white">{settings.wpm}</span>{' '}
              <span className="text-zinc-400">WPM</span>
            </div>
            <button
              type="button"
              onClick={() =>
                onUpdateSettings({ wpm: Math.min(260, settings.wpm + 5) })
              }
              className="p-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Faster (+5 WPM / Up Arrow)"
              aria-label="Increase reading speed"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <span aria-hidden="true" className="h-5 w-px bg-white/15 shrink-0" />

          {/* Stage Font Size Adjuster */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() =>
                onUpdateSettings({
                  fontSize: Math.max(28, settings.fontSize - 4),
                })
              }
              className="px-2 py-1 rounded-lg text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Smaller font (-)"
            >
              A-
            </button>
            <span className="font-mono tabular-nums text-xs text-zinc-300 w-9 text-center">
              {settings.fontSize}
            </span>
            <button
              type="button"
              onClick={() =>
                onUpdateSettings({
                  fontSize: Math.min(96, settings.fontSize + 4),
                })
              }
              className="px-2 py-1 rounded-lg text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Larger font (+)"
            >
              A+
            </button>
          </div>

          <span aria-hidden="true" className="h-5 w-px bg-white/15 shrink-0" />

          {/* Mirror Horizontal Toggle */}
          <button
            type="button"
            onClick={() =>
              onUpdateSettings({ mirrorHorizontal: !settings.mirrorHorizontal })
            }
            className={`p-2 rounded-xl transition-colors shrink-0 cursor-pointer ${
              settings.mirrorHorizontal
                ? 'bg-[#FF6A00]/25 text-[#FF8A32] border border-[#FF6A00]/50'
                : 'text-zinc-300 hover:text-white hover:bg-white/10'
            }`}
            title="Mirror Horizontal for beam-splitter glass (M)"
            aria-label="Toggle horizontal mirror"
          >
            <FlipHorizontal className="w-4 h-4" />
          </button>

          {/* Mirror Vertical Toggle */}
          <button
            type="button"
            onClick={() =>
              onUpdateSettings({ mirrorVertical: !settings.mirrorVertical })
            }
            className={`hidden sm:inline-flex p-2 rounded-xl transition-colors shrink-0 cursor-pointer ${
              settings.mirrorVertical
                ? 'bg-[#FF6A00]/25 text-[#FF8A32] border border-[#FF6A00]/50'
                : 'text-zinc-300 hover:text-white hover:bg-white/10'
            }`}
            title="Mirror Vertical (V)"
            aria-label="Toggle vertical mirror"
          >
            <FlipVertical className="w-4 h-4" />
          </button>

          {/* Reading Guide Toggle */}
          <button
            type="button"
            onClick={() =>
              onUpdateSettings({ showReadingGuide: !settings.showReadingGuide })
            }
            className={`p-2 rounded-xl transition-colors shrink-0 cursor-pointer ${
              settings.showReadingGuide
                ? 'bg-[#FF6A00]/25 text-[#FF8A32] border border-[#FF6A00]/50'
                : 'text-zinc-300 hover:text-white hover:bg-white/10'
            }`}
            title="Toggle Eye-Line Focus Guide (G)"
            aria-label="Toggle eye-line reading guide"
          >
            <Eye className="w-4 h-4" />
          </button>

          {/* Presenter Camera Preview Toggle */}
          <button
            type="button"
            onClick={toggleCamera}
            className={`p-2 rounded-xl transition-colors shrink-0 cursor-pointer ${
              isCameraEnabled
                ? 'bg-[#FF6A00]/25 text-[#FF8A32] border border-[#FF6A00]/50'
                : 'text-zinc-300 hover:text-white hover:bg-white/10'
            }`}
            title="Toggle Presenter Camera Eye-Line Preview (C)"
            aria-label="Toggle camera preview"
          >
            {isCameraEnabled ? (
              <Video className="w-4 h-4" />
            ) : (
              <VideoOff className="w-4 h-4" />
            )}
          </button>

          {/* Quick Settings Panel Toggle */}
          <button
            type="button"
            onClick={() => setShowQuickSettings((prev) => !prev)}
            className={`p-2 rounded-xl transition-colors shrink-0 cursor-pointer ${
              showQuickSettings
                ? 'bg-[#FF6A00]/25 text-[#FF8A32] border border-[#FF6A00]/50'
                : 'text-zinc-300 hover:text-white hover:bg-white/10'
            }`}
            title="Tune Text Width, Margins & Typography"
            aria-label="Quick Settings"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2 rounded-xl text-zinc-300 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
            title="Toggle Fullscreen (F)"
            aria-label="Toggle fullscreen"
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </footer>

      {/* In-Prompter Quick Settings Drawer */}
      {showQuickSettings && (
        <aside
          aria-label="In-prompter display settings"
          onClick={(e) => e.stopPropagation()}
          className="fixed right-0 top-14 bottom-0 z-40 w-80 max-w-[85vw] bg-[#171717]/95 border-l border-white/15 p-5 text-[#FAF9F6] shadow-2xl backdrop-blur-md overflow-y-auto space-y-5"
        >
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <h3 className="text-xs font-semibold text-white">
              Display & Layout
            </h3>
            <button
              type="button"
              onClick={() => setShowQuickSettings(false)}
              className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer"
              aria-label="Close settings"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Reading Column Width (Margins) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-300 font-medium">Text Width</span>
              <span className="font-mono tabular-nums text-[#FF8A32]">
                {settings.contentWidthPercent}%
              </span>
            </div>
            <input
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
            <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
              <span>Narrow (45%)</span>
              <span>Wide (92%)</span>
            </div>
          </div>

          {/* Line Spacing */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-300 font-medium">Line Spacing</span>
              <span className="font-mono tabular-nums text-[#FF8A32]">
                {settings.lineHeight.toFixed(2)}×
              </span>
            </div>
            <input
              type="range"
              min={1.2}
              max={2.1}
              step={0.05}
              value={settings.lineHeight}
              onChange={(e) =>
                onUpdateSettings({ lineHeight: Number(e.target.value) })
              }
              className="w-full accent-[#FF6A00] cursor-pointer"
            />
          </div>

          {/* Font Family */}
          <div className="space-y-1.5">
            <span className="text-xs text-zinc-300 font-medium block">
              Typography
            </span>
            <div className="grid grid-cols-3 gap-1 p-1 bg-[#242424] rounded-lg">
              {fontOptions.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => onUpdateSettings({ fontFamily: f.id })}
                  className={`px-2 py-1 text-xs rounded transition-colors cursor-pointer ${
                    settings.fontFamily === f.id
                      ? 'bg-[#FF6A00] text-white font-semibold'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Alignment */}
          <div className="space-y-1.5">
            <span className="text-xs text-zinc-300 font-medium block">
              Alignment
            </span>
            <div className="grid grid-cols-2 gap-1 p-1 bg-[#242424] rounded-lg">
              <button
                type="button"
                onClick={() => onUpdateSettings({ textAlign: 'left' })}
                className={`flex items-center justify-center gap-1.5 px-2 py-1 text-xs rounded transition-colors cursor-pointer ${
                  settings.textAlign === 'left'
                    ? 'bg-[#FF6A00] text-white font-semibold'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <AlignLeft className="w-3.5 h-3.5" />
                <span>Left</span>
              </button>
              <button
                type="button"
                onClick={() => onUpdateSettings({ textAlign: 'center' })}
                className={`flex items-center justify-center gap-1.5 px-2 py-1 text-xs rounded transition-colors cursor-pointer ${
                  settings.textAlign === 'center'
                    ? 'bg-[#FF6A00] text-white font-semibold'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <AlignCenter className="w-3.5 h-3.5" />
                <span>Center</span>
              </button>
            </div>
          </div>

          {/* Stage Surface Theme */}
          <div className="space-y-1.5">
            <span className="text-xs text-zinc-300 font-medium block">
              Prompter Theme
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {surfaceOptions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onUpdateSettings({ prompterTheme: s.id })}
                  className={`flex items-center gap-2 p-2 rounded-lg border text-xs transition-colors cursor-pointer ${
                    settings.prompterTheme === s.id
                      ? 'border-[#FF6A00] bg-[#FF6A00]/15 text-white font-semibold'
                      : 'border-white/10 text-zinc-400 hover:border-white/25'
                  }`}
                >
                  <span
                    className={`w-3.5 h-3.5 rounded-full border border-white/20 shrink-0 ${s.bgClass}`}
                  />
                  <span className="truncate">{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Eye-Line Guide Position */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-300 font-medium">Eye-Line Height</span>
              <span className="font-mono tabular-nums text-[#FF8A32]">
                {settings.readingGuidePosition}%
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
          </div>

          {/* Countdown Setting */}
          <div className="space-y-1.5 pt-2 border-t border-white/10">
            <span className="text-xs text-zinc-300 font-medium block">
              Countdown Seconds
            </span>
            <div className="grid grid-cols-4 gap-1 p-1 bg-[#242424] rounded-lg">
              {[0, 3, 5, 10].map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => onUpdateSettings({ countdownSeconds: sec })}
                  className={`py-1 text-xs font-mono font-medium rounded transition-colors cursor-pointer ${
                    settings.countdownSeconds === sec
                      ? 'bg-[#FF6A00] text-white'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {sec === 0 ? 'Off' : `${sec}s`}
                </button>
              ))}
            </div>
          </div>
        </aside>
      )}

      {/* In-Prompter Keyboard Shortcuts Modal */}
      {showShortcutsModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={() => setShowShortcutsModal(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="in-prompter-shortcuts-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl bg-[#171717] border border-white/15 p-5 shadow-2xl text-[#FAF9F6]"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3
                id="in-prompter-shortcuts-title"
                className="text-sm font-semibold text-white flex items-center gap-2"
              >
                <Keyboard className="w-4 h-4 text-[#FF6A00]" />
                <span>Teleprompter Shortcuts</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowShortcutsModal(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer"
                aria-label="Close shortcuts"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-3 divide-y divide-white/10 text-xs">
              <div className="flex items-center justify-between py-2">
                <span className="text-zinc-300">Play / Pause</span>
                <kbd className="px-2 py-0.5 rounded bg-[#242424] border border-white/15 font-mono text-zinc-200">
                  Space
                </kbd>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-zinc-300">Reading speed</span>
                <kbd className="px-2 py-0.5 rounded bg-[#242424] border border-white/15 font-mono text-zinc-200">
                  ↑ / ↓
                </kbd>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-zinc-300">Font size</span>
                <kbd className="px-2 py-0.5 rounded bg-[#242424] border border-white/15 font-mono text-zinc-200">
                  + / -
                </kbd>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-zinc-300">Restart from top</span>
                <kbd className="px-2 py-0.5 rounded bg-[#242424] border border-white/15 font-mono text-zinc-200">
                  R
                </kbd>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-zinc-300">Mirror text (H / V)</span>
                <kbd className="px-2 py-0.5 rounded bg-[#242424] border border-white/15 font-mono text-zinc-200">
                  M / V
                </kbd>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-zinc-300">Eye-line guide</span>
                <kbd className="px-2 py-0.5 rounded bg-[#242424] border border-white/15 font-mono text-zinc-200">
                  G
                </kbd>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-zinc-300">Presenter camera</span>
                <kbd className="px-2 py-0.5 rounded bg-[#242424] border border-white/15 font-mono text-zinc-200">
                  C
                </kbd>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-zinc-300">Fullscreen</span>
                <kbd className="px-2 py-0.5 rounded bg-[#242424] border border-white/15 font-mono text-zinc-200">
                  F
                </kbd>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-zinc-300">Exit to editor</span>
                <kbd className="px-2 py-0.5 rounded bg-[#242424] border border-white/15 font-mono text-zinc-200">
                  Esc
                </kbd>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
