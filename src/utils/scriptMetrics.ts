import { ScriptStats } from '../types/teleprompter';

export interface ParsedScriptLine {
  id: string;
  type: 'heading' | 'cue-pause' | 'cue-direction' | 'paragraph' | 'spacer';
  text: string;
  pauseSeconds?: number;
}

/**
 * Calculates accurate word count, character count, paragraph count, and speaking duration.
 * Excludes cue markers like [PAUSE 2s] from spoken word count while adding their seconds to total time.
 */
export function calculateScriptStats(content: string, wpm: number): ScriptStats {
  const trimmed = content.trim();
  if (!trimmed) {
    return {
      words: 0,
      characters: content.length,
      paragraphs: 0,
      estimatedSeconds: 0,
      pauseCueSeconds: 0,
    };
  }

  // Extract [PAUSE Xs] cues and sum their seconds
  let pauseCueSeconds = 0;
  const pauseRegex = /\[\s*PAUSE\s+(\d+(?:\.\d+)?)s?\s*\]/gi;
  let match: RegExpExecArray | null;
  while ((match = pauseRegex.exec(trimmed)) !== null) {
    const secs = parseFloat(match[1]);
    if (!Number.isNaN(secs)) {
      pauseCueSeconds += secs;
    }
  }

  // Strip stage cues like [PAUSE 2s], [SLOW], [BREATHE], markdown # symbols for spoken word count
  const spokenText = trimmed
    .replace(/\[[^\]]+\]/g, ' ')
    .replace(/^#+\s*/gm, '')
    .trim();

  const words = spokenText
    ? spokenText.split(/\s+/).filter((w) => w.length > 0).length
    : 0;

  const characters = content.length;

  const paragraphs = trimmed
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && !/^\[[^\]]+\]$/.test(p)).length;

  const safeWpm = Math.max(40, wpm || 130);
  const spokenSeconds = words > 0 ? Math.ceil((words / safeWpm) * 60) : 0;
  const estimatedSeconds = spokenSeconds + Math.round(pauseCueSeconds);

  return {
    words,
    characters,
    paragraphs,
    estimatedSeconds,
    pauseCueSeconds,
  };
}

/**
 * Formats seconds into human-readable duration (e.g. "2m 15s" or "45s")
 */
export function formatDurationReadable(totalSeconds: number): string {
  if (totalSeconds <= 0) return '0s';
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = Math.round(totalSeconds % 60);

  if (hours > 0) {
    if (mins === 0 && secs === 0) return `${hours}h`;
    if (secs === 0) return `${hours}h ${mins}m`;
    return `${hours}h ${mins}m ${secs}s`;
  }
  if (mins === 0) return `${secs}s`;
  if (secs === 0) return `${mins}m`;
  return `${mins}m ${secs}s`;
}

/**
 * Formats seconds into MM:SS (or HH:MM:SS for long presentations) clock string
 */
export function formatClockTimer(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(clamped / 3600);
  const mins = Math.floor((clamped % 3600) / 60);
  const secs = clamped % 60;

  if (hours > 0) {
    return `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Formats a timestamp into a concise relative time label for the Script Library
 */
export function formatRelativeTime(timestamp: number): string {
  const diffSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSeconds < 45) return 'Just now';
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 30) return `${diffDays}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Parses raw script text into structured blocks for the teleprompter stage
 * while preserving paragraph breaks, single line breaks, punctuation, and extra vertical spacing.
 */
export function parseScriptLines(content: string): ParsedScriptLine[] {
  const normalized = content.replace(/\r\n/g, '\n');
  const rawLines = normalized.split('\n');
  const parsed: ParsedScriptLine[] = [];

  let paragraphBuffer: string[] = [];
  let paragraphStartIdx = 0;
  let consecutiveBlankLines = 0;

  const flushParagraph = () => {
    if (paragraphBuffer.length > 0) {
      parsed.push({
        id: `para-${paragraphStartIdx}`,
        type: 'paragraph',
        text: paragraphBuffer.join('\n'),
      });
      paragraphBuffer = [];
    }
  };

  rawLines.forEach((raw, idx) => {
    const trimmed = raw.trim();

    if (!trimmed) {
      flushParagraph();
      consecutiveBlankLines += 1;
      // Preserve intentional multi-line blank spacing (2+ blank lines create an extra visual breath)
      if (consecutiveBlankLines === 2 && parsed.length > 0) {
        parsed.push({
          id: `spacer-${idx}`,
          type: 'spacer',
          text: '',
        });
      }
      return;
    }

    consecutiveBlankLines = 0;

    // Heading (# Section)
    if (trimmed.startsWith('#')) {
      flushParagraph();
      parsed.push({
        id: `line-${idx}`,
        type: 'heading',
        text: trimmed.replace(/^#+\s*/, ''),
      });
      return;
    }

    // Standalone pause cue: [PAUSE 2s]
    const pauseMatch = trimmed.match(/^\[\s*PAUSE\s+(\d+(?:\.\d+)?)s?\s*\]$/i);
    if (pauseMatch) {
      flushParagraph();
      parsed.push({
        id: `line-${idx}`,
        type: 'cue-pause',
        text: `Pause ${pauseMatch[1]}s`,
        pauseSeconds: parseFloat(pauseMatch[1]),
      });
      return;
    }

    // Standalone stage direction: [SLOW], [BREATHE], [SMILE]
    const cueMatch = trimmed.match(/^\[([^\]]+)\]$/);
    if (cueMatch) {
      flushParagraph();
      parsed.push({
        id: `line-${idx}`,
        type: 'cue-direction',
        text: cueMatch[1].trim(),
      });
      return;
    }

    // Regular text line: accumulate into current paragraph block to preserve single line breaks (\n)
    if (paragraphBuffer.length === 0) {
      paragraphStartIdx = idx;
    }
    paragraphBuffer.push(raw);
  });

  flushParagraph();

  return parsed;
}
