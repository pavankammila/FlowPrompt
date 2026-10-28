export type ThemeMode = 'light' | 'dark';

export type PrompterFontFamily = 'sans' | 'serif' | 'mono';

export type TextAlignment = 'left' | 'center';

export type PrompterThemePreset = 'pitch-black' | 'deep-charcoal' | 'warm-paper' | 'high-contrast';

export type SaveStatus = 'saved' | 'saving' | 'error';

export type RecordingStatus = 'idle' | 'countdown' | 'recording' | 'paused' | 'stopped';

export type RecordingSessionState =
  | 'idle'
  | 'requesting-permission'
  | 'ready'
  | 'countdown'
  | 'recording'
  | 'paused'
  | 'finalizing'
  | 'completed'
  | 'error';

export interface StudioDiagnosticError {
  stage: 'camera-access' | 'device-enumeration' | 'media-recorder-init' | 'recording-runtime' | 'finalizing';
  errorName: string;
  message: string;
  technicalDetails?: string;
}

export type StudioLayout = 'eye-contact' | 'split';

export interface RecordedTake {
  blob: Blob;
  url: string;
  durationSeconds: number;
  sizeBytes: number;
  mimeType: string;
  timestamp: number;
}

export interface TeleprompterSettings {
  /** Words per minute target reading pace (60 - 260), defaults to 130 */
  wpm: number;
  /** Font size in pixels for the teleprompter stage (28 - 96) */
  fontSize: number;
  /** Line height multiplier (1.2 - 2.0) */
  lineHeight: number;
  /** Max content width percentage on screen (45 - 92) */
  contentWidthPercent: number;
  /** Font family inside the teleprompter */
  fontFamily: PrompterFontFamily;
  /** Text alignment inside the teleprompter */
  textAlign: TextAlignment;
  /** Horizontal flip for physical beam-splitter teleprompter glass */
  mirrorHorizontal: boolean;
  /** Vertical flip for inverted monitor rigs */
  mirrorVertical: boolean;
  /** Show horizontal eye-line reading guide band */
  showReadingGuide: boolean;
  /** Vertical position of the reading guide from top (20% - 60%) */
  readingGuidePosition: number;
  /** Dim text outside the active reading guide zone */
  dimSurroundingText: boolean;
  /** Countdown seconds before scrolling starts (0, 3, 5, 10) */
  countdownSeconds: number;
  /** Automatically pause when encountering [PAUSE Xs] cues */
  honorPauseCues: boolean;
  /** Loop back to start when reaching the end of the script */
  autoLoop: boolean;
  /** Color surface preset for the teleprompter reading screen */
  prompterTheme: PrompterThemePreset;
  /** Editor font size in pixels (15 - 24) */
  editorFontSize: number;
}

export interface ScriptDocument {
  id: string;
  title: string;
  content: string;
  category: string;
  updatedAt: number;
}

export interface ScriptStats {
  words: number;
  characters: number;
  paragraphs: number;
  estimatedSeconds: number;
  pauseCueSeconds: number;
}

export interface ToastMessage {
  id: string;
  text: string;
  type?: 'info' | 'success' | 'warning';
}
