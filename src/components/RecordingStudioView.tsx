import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Circle,
  Pause,
  Play,
  Square,
  RotateCcw,
  Download,
  ArrowLeft,
  FlipHorizontal,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  Eye,
  Minus,
  Plus,
  Sun,
  Moon,
  Sliders,
  Sparkles,
  Volume2,
  VolumeX,
  RefreshCw,
  Loader2,
  HelpCircle,
} from 'lucide-react';
import {
  RecordedTake,
  RecordingSessionState,
  ScriptStats,
  StudioDiagnosticError,
  StudioLayout,
  TeleprompterSettings,
  ThemeMode,
} from '../types/teleprompter';
import {
  formatClockTimer,
  parseScriptLines,
  ParsedScriptLine,
} from '../utils/scriptMetrics';
import { FlowPromptLogo } from './FlowPromptLogo';

interface RecordingStudioViewProps {
  scriptTitle: string;
  content: string;
  settings: TeleprompterSettings;
  stats: ScriptStats;
  theme?: ThemeMode;
  onToggleTheme?: () => void;
  onUpdateSettings: (partial: Partial<TeleprompterSettings>) => void;
  onExit: () => void;
}

export const RecordingStudioView: React.FC<RecordingStudioViewProps> = ({
  scriptTitle,
  content,
  settings,
  stats,
  theme = 'dark',
  onToggleTheme,
  onUpdateSettings,
  onExit,
}) => {
  // Session State Machine: idle -> requesting-permission -> ready -> countdown -> recording -> paused -> finalizing -> completed | error
  const [sessionState, setSessionState] = useState<RecordingSessionState>('idle');
  const [diagnosticError, setDiagnosticError] = useState<StudioDiagnosticError | null>(null);

  // Hardware devices and layout state
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState<string>('');
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState<string>('');
  const [previewMirrored, setPreviewMirrored] = useState<boolean>(true);
  const [layoutMode, setLayoutMode] = useState<StudioLayout>('eye-contact');
  const [autoScrollWithRecord, setAutoScrollWithRecord] = useState<boolean>(true);
  const [showDeviceSettings, setShowDeviceSettings] = useState<boolean>(false);

  // Track availability & mute states
  const [hasVideoTrack, setHasVideoTrack] = useState<boolean>(false);
  const [hasAudioTrack, setHasAudioTrack] = useState<boolean>(false);
  const [isCameraOff, setIsCameraOff] = useState<boolean>(false);
  const [isMicMuted, setIsMicMuted] = useState<boolean>(false);
  const [trackWarning, setTrackWarning] = useState<string | null>(null);

  // Recording engine state
  const [recordingCountdown, setRecordingCountdown] = useState<number>(0);
  const [recordedSeconds, setRecordedSeconds] = useState<number>(0);
  const [recordedTake, setRecordedTake] = useState<RecordedTake | null>(null);
  const [micVolume, setMicVolume] = useState<number>(0); // 0 to 100 for audio meter

  // Teleprompter scroll engine state
  const [isPrompterScrolling, setIsPrompterScrolling] = useState<boolean>(false);
  const [, setPrompterProgress] = useState<number>(0);

  // Take review player sound state
  const [isReviewMuted, setIsReviewMuted] = useState<boolean>(false);

  // Persistent React refs to prevent stale closures and duplicate sessions
  const isMountedRef = useRef<boolean>(true);
  const videoPreviewNodeRef = useRef<HTMLVideoElement | null>(null);
  const reviewVideoNodeRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const selectedMimeTypeRef = useRef<string>('');
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioAnalyserRef = useRef<AnalyserNode | null>(null);
  const audioAnimFrameRef = useRef<number | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollPosRef = useRef<number>(0);
  const lastScrollTimeRef = useRef<number | null>(null);
  const scrollAnimFrameRef = useRef<number | null>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const countdownTimerRef = useRef<number | null>(null);
  const recordedSecondsRef = useRef<number>(0);
  const recordingStartTimeRef = useRef<number>(0);

  const parsedLines: ParsedScriptLine[] = useMemo(
    () => parseScriptLines(content),
    [content]
  );

  // Lifecycle mount check
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Prevent background page scrolling
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // Safely stop all active media stream tracks, timers and audio contexts
  const cleanupMedia = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // Ignore
      }
      mediaRecorderRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // Ignore
        }
      });
      mediaStreamRef.current = null;
    }
    if (audioAnimFrameRef.current) {
      cancelAnimationFrame(audioAnimFrameRef.current);
      audioAnimFrameRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close().catch(() => {});
      } catch {
        // Ignore
      }
      audioContextRef.current = null;
    }
    if (videoPreviewNodeRef.current) {
      videoPreviewNodeRef.current.srcObject = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupMedia();
      if (scrollAnimFrameRef.current) cancelAnimationFrame(scrollAnimFrameRef.current);
      if (recordedTake?.url) {
        URL.revokeObjectURL(recordedTake.url);
      }
    };
  }, [cleanupMedia, recordedTake]);

  // Callback ref to reliably attach MediaStream to mounted video preview element and call play()
  const setVideoPreviewRef = useCallback((node: HTMLVideoElement | null) => {
    videoPreviewNodeRef.current = node;
    if (node && mediaStreamRef.current) {
      if (node.srcObject !== mediaStreamRef.current) {
        node.srcObject = mediaStreamRef.current;
      }
      const playPromise = node.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          if (err.name !== 'AbortError') {
            console.warn('[FLOWPROMPT] Video preview play promise rejected:', err);
          }
        });
      }
    }
  }, []);

  // Set up live microphone volume meter via Web Audio API AnalyserNode
  const setupAudioMeter = useCallback((stream: MediaStream) => {
    if (stream.getAudioTracks().length === 0) {
      setMicVolume(0);
      return;
    }

    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;

      if (audioContextRef.current) {
        try {
          audioContextRef.current.close().catch(() => {});
        } catch {
          // Ignore
        }
      }

      const audioCtx = new AudioContextClass();
      audioContextRef.current = audioCtx;

      // Ensure AudioContext is active
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);
      audioAnalyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      if (audioAnimFrameRef.current) {
        cancelAnimationFrame(audioAnimFrameRef.current);
      }

      const checkVolume = () => {
        if (!isMountedRef.current) return;
        if (!audioAnalyserRef.current || isMicMuted) {
          setMicVolume(0);
          audioAnimFrameRef.current = requestAnimationFrame(checkVolume);
          return;
        }

        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume().catch(() => {});
        }

        audioAnalyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const normalized = Math.min(100, Math.round((average / 110) * 100));
        setMicVolume(normalized);
        audioAnimFrameRef.current = requestAnimationFrame(checkVolume);
      };

      audioAnimFrameRef.current = requestAnimationFrame(checkVolume);
    } catch {
      // Audio meter failure is non-fatal
    }
  }, [isMicMuted]);

  // Request camera and microphone access with native MediaStream verification
  const initializeMedia = useCallback(
    async (videoDeviceId?: string, audioDeviceId?: string) => {
      cleanupMedia();
      setDiagnosticError(null);
      setTrackWarning(null);
      setSessionState('requesting-permission');

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (!isMountedRef.current) return;
        setDiagnosticError({
          stage: 'camera-access',
          errorName: 'NotSupportedError',
          message:
            'Media recording is not supported in this browser or requires a secure context (HTTPS or localhost).',
          technicalDetails: 'navigator.mediaDevices.getUserMedia is undefined.',
        });
        setSessionState('error');
        return;
      }

      try {
        let stream: MediaStream | null = null;

        // Explicitly set video: true and audio: true in constraints
        const primaryConstraints: MediaStreamConstraints = {
          video: videoDeviceId
            ? { deviceId: { ideal: videoDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
            : true,
          audio: audioDeviceId
            ? { deviceId: { ideal: audioDeviceId }, echoCancellation: true, noiseSuppression: true }
            : true,
        };

        try {
          stream = await navigator.mediaDevices.getUserMedia(primaryConstraints);
        } catch (firstErr: unknown) {
          // Fall back to unconstrained video: true and audio: true
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: true,
            });
          } catch (secondErr: unknown) {
            // Progressive fallback: video only if mic is busy or missing
            try {
              stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            } catch {
              // Progressive fallback: audio only if camera is busy or missing
              try {
                stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
              } catch {
                throw firstErr; // Throw original error to capture true root cause
              }
            }
          }
        }

        if (!isMountedRef.current) {
          if (stream) stream.getTracks().forEach((t) => t.stop());
          return;
        }

        if (!stream) {
          throw new Error('MediaStream could not be acquired.');
        }

        // Verify MediaStream active state
        if (!stream.active) {
          throw new Error('MediaStream was acquired but is marked as inactive by the browser.');
        }

        mediaStreamRef.current = stream;

        const vTracks = stream.getVideoTracks();
        const aTracks = stream.getAudioTracks();

        setHasVideoTrack(vTracks.length > 0);
        setHasAudioTrack(aTracks.length > 0);

        // Check for silent hardware failure conditions
        const silentFailures: string[] = [];

        if (vTracks.length === 0) {
          silentFailures.push('No video track returned (webcam unavailable or blocked)');
        } else {
          const vTrack = vTracks[0];
          if (vTrack.readyState === 'ended') {
            silentFailures.push('Webcam video track ended immediately after acquisition');
          }
          if (vTrack.muted) {
            silentFailures.push('Camera is muted by operating system or hardware shutter');
          }
          vTrack.onended = () => {
            if (isMountedRef.current) {
              setTrackWarning('Camera device disconnected or was closed by another app.');
              setHasVideoTrack(false);
            }
          };
          vTrack.onmute = () => {
            if (isMountedRef.current) {
              setTrackWarning('Camera stream muted (check physical shutter or OS permissions).');
            }
          };
          vTrack.onunmute = () => {
            if (isMountedRef.current) setTrackWarning(null);
          };
        }

        if (aTracks.length === 0) {
          silentFailures.push('No audio track returned (microphone unavailable or blocked)');
        } else {
          const aTrack = aTracks[0];
          if (aTrack.readyState === 'ended') {
            silentFailures.push('Microphone audio track ended immediately after acquisition');
          }
          if (aTrack.muted) {
            silentFailures.push('Microphone is muted by operating system or hardware switch');
          }
          aTrack.onended = () => {
            if (isMountedRef.current) {
              setTrackWarning('Microphone device disconnected or was closed.');
              setHasAudioTrack(false);
            }
          };
          aTrack.onmute = () => {
            if (isMountedRef.current) {
              setTrackWarning('Microphone muted by OS privacy setting or hardware mute switch.');
            }
          };
          aTrack.onunmute = () => {
            if (isMountedRef.current) setTrackWarning(null);
          };
        }

        if (silentFailures.length > 0) {
          setTrackWarning(silentFailures.join(' · '));
        } else {
          setTrackWarning(null);
        }

        // Apply initial mute states
        vTracks.forEach((t) => {
          t.enabled = !isCameraOff;
        });
        aTracks.forEach((t) => {
          t.enabled = !isMicMuted;
        });

        // Attach stream to mounted preview element and play
        if (videoPreviewNodeRef.current) {
          videoPreviewNodeRef.current.srcObject = stream;
          const p = videoPreviewNodeRef.current.play();
          if (p !== undefined) p.catch(() => {});
        }

        // Initialize audio frequency analyser
        setupAudioMeter(stream);

        // Transition to ready state
        setSessionState('ready');

        // Enumerate devices for selector dropdowns
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          if (isMountedRef.current) {
            setVideoDevices(devices.filter((d) => d.kind === 'videoinput'));
            setAudioDevices(devices.filter((d) => d.kind === 'audioinput'));
            const activeV = vTracks[0]?.getSettings().deviceId;
            const activeA = aTracks[0]?.getSettings().deviceId;
            if (activeV) setSelectedVideoDeviceId(activeV);
            if (activeA) setSelectedAudioDeviceId(activeA);
          }
        } catch {
          // Device enumeration failure is non-fatal
        }
      } catch (err: unknown) {
        if (!isMountedRef.current) return;
        const error = err as { name?: string; message?: string };
        const errorName = error.name || 'CameraAccessError';

        let friendlyMessage = 'Unable to access your camera or microphone.';
        if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
          friendlyMessage =
            'Camera and microphone permissions were denied. Please click the lock or camera icon in your browser address bar to allow access and click "Retry Connection".';
        } else if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
          friendlyMessage =
            'No camera or microphone hardware was detected. Please connect a webcam or headset and click "Retry Connection".';
        } else if (errorName === 'NotReadableError' || errorName === 'TrackStartError') {
          friendlyMessage =
            'Your camera or microphone is already in use by another app (e.g. Zoom, Google Meet, Teams, or another tab). Please close competing apps and click "Retry Connection".';
        } else if (errorName === 'OverconstrainedError') {
          friendlyMessage =
            'The requested camera resolution or device ID is not supported by your hardware.';
        }

        setDiagnosticError({
          stage: 'camera-access',
          errorName,
          message: friendlyMessage,
          technicalDetails: error.message || String(err),
        });
        setSessionState('error');
      }
    },
    [cleanupMedia, isCameraOff, isMicMuted, setupAudioMeter]
  );

  // Check permission status on mount: if already granted, auto-connect; otherwise remain in 'idle' so user can click 'Allow Access & Start Studio'
  useEffect(() => {
    let isCancelled = false;

    const checkInitialPermission = async () => {
      try {
        if (typeof navigator !== 'undefined' && navigator.permissions && navigator.permissions.query) {
          const camQuery = await navigator.permissions.query({ name: 'camera' as PermissionName });
          if (isCancelled) return;
          if (camQuery.state === 'granted') {
            initializeMedia();
            return;
          }
        }
      } catch {
        // Permissions query unsupported or rejected
      }

      if (!isCancelled) {
        setSessionState('idle');
      }
    };

    checkInitialPermission();

    return () => {
      isCancelled = true;
    };
  }, [initializeMedia]);

  // Switch video input device
  const handleSelectVideoDevice = (deviceId: string) => {
    if (sessionState === 'recording' || sessionState === 'finalizing') return;
    setSelectedVideoDeviceId(deviceId);
    initializeMedia(deviceId, selectedAudioDeviceId);
  };

  // Switch audio input device
  const handleSelectAudioDevice = (deviceId: string) => {
    if (sessionState === 'recording' || sessionState === 'finalizing') return;
    setSelectedAudioDeviceId(deviceId);
    initializeMedia(selectedVideoDeviceId, deviceId);
  };

  // Toggle Camera mute
  const handleToggleCamera = () => {
    setIsCameraOff((prev) => {
      const next = !prev;
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getVideoTracks().forEach((track) => {
          track.enabled = !next;
        });
      }
      return next;
    });
  };

  // Toggle Microphone mute
  const handleToggleMic = () => {
    setIsMicMuted((prev) => {
      const next = !prev;
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getAudioTracks().forEach((track) => {
          track.enabled = !next;
        });
      }
      if (next) setMicVolume(0);
      return next;
    });
  };

  // Teleprompter auto-scroll engine
  useEffect(() => {
    if (!isPrompterScrolling) {
      lastScrollTimeRef.current = null;
      if (scrollAnimFrameRef.current) {
        cancelAnimationFrame(scrollAnimFrameRef.current);
        scrollAnimFrameRef.current = null;
      }
      return;
    }

    const step = (timestamp: number) => {
      const container = scrollContainerRef.current;
      if (!container) return;

      if (lastScrollTimeRef.current === null) {
        lastScrollTimeRef.current = timestamp;
        scrollPosRef.current = container.scrollTop;
      }

      const deltaSeconds = Math.min(0.1, (timestamp - lastScrollTimeRef.current) / 1000);
      lastScrollTimeRef.current = timestamp;

      const maxScroll = Math.max(1, container.scrollHeight - container.clientHeight);
      const effectiveWords = Math.max(10, stats.words || 50);
      const spokenDurationSeconds = Math.max(
        6,
        (effectiveWords / Math.max(40, settings.wpm)) * 60
      );
      const pixelsPerSecond = maxScroll / spokenDurationSeconds;

      scrollPosRef.current = Math.min(
        maxScroll,
        scrollPosRef.current + pixelsPerSecond * deltaSeconds
      );
      container.scrollTop = scrollPosRef.current;

      const prog = Math.min(1, scrollPosRef.current / maxScroll);
      setPrompterProgress(prog);

      if (scrollPosRef.current >= maxScroll - 1) {
        setIsPrompterScrolling(false);
        return;
      }

      scrollAnimFrameRef.current = requestAnimationFrame(step);
    };

    scrollAnimFrameRef.current = requestAnimationFrame(step);
    return () => {
      if (scrollAnimFrameRef.current) {
        cancelAnimationFrame(scrollAnimFrameRef.current);
        scrollAnimFrameRef.current = null;
      }
    };
  }, [isPrompterScrolling, settings.wpm, stats.words]);

  const handleManualPrompterScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const maxScroll = Math.max(1, container.scrollHeight - container.clientHeight);
    scrollPosRef.current = container.scrollTop;
    setPrompterProgress(Math.min(1, container.scrollTop / maxScroll));
  };

  // Helper to select optimal supported MediaRecorder MIME type
  const selectSupportedMimeType = (): string => {
    if (typeof MediaRecorder === 'undefined') return '';
    const candidates = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4;codecs=avc1,mp4a.40.2',
      'video/mp4',
    ];
    for (const mime of candidates) {
      try {
        if (typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(mime)) {
          return mime;
        }
      } catch {
        // Continue
      }
    }
    return '';
  };

  // Reliable MediaRecorder creation and session start
  const executeStartRecording = () => {
    const stream = mediaStreamRef.current;
    if (!stream || !stream.active) {
      setDiagnosticError({
        stage: 'media-recorder-init',
        errorName: 'InactiveStreamError',
        message: 'Cannot record because camera stream is inactive or disconnected.',
      });
      setSessionState('error');
      return;
    }

    if (typeof MediaRecorder === 'undefined') {
      setDiagnosticError({
        stage: 'media-recorder-init',
        errorName: 'NotSupportedError',
        message: 'MediaRecorder API is not supported in this browser.',
      });
      setSessionState('error');
      return;
    }

    // Wake up AudioContext on user interaction
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().catch(() => {});
    }

    // Clear previous chunks and recorder instance to prevent duplicates
    recordedChunksRef.current = [];
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // Ignore
      }
    }

    try {
      const optimalMime = selectSupportedMimeType();
      let recorder: MediaRecorder;

      if (optimalMime) {
        try {
          recorder = new MediaRecorder(stream, { mimeType: optimalMime });
          selectedMimeTypeRef.current = optimalMime;
        } catch (mimeErr) {
          console.warn('[FLOWPROMPT] MIME constructor rejected, falling back to default:', mimeErr);
          recorder = new MediaRecorder(stream);
          selectedMimeTypeRef.current = recorder.mimeType || 'video/webm';
        }
      } else {
        recorder = new MediaRecorder(stream);
        selectedMimeTypeRef.current = recorder.mimeType || 'video/webm';
      }

      mediaRecorderRef.current = recorder;

      // Collect every non-empty chunk
      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      // Handle recorder error
      recorder.onerror = (event: Event) => {
        const error = (event as unknown as { error?: DOMException }).error;
        console.error('[FLOWPROMPT MediaRecorder Runtime Error]:', error);
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        setDiagnosticError({
          stage: 'recording-runtime',
          errorName: error?.name || 'MediaRecorderError',
          message: 'An error occurred during video recording.',
          technicalDetails: error?.message || 'MediaRecorder error event fired.',
        });
        setSessionState('error');
      };

      // Finalize take ONLY in onstop
      recorder.onstop = () => {
        if (!isMountedRef.current) return;

        if (recordedChunksRef.current.length === 0) {
          setDiagnosticError({
            stage: 'finalizing',
            errorName: 'EmptyRecordingError',
            message:
              'No video data was captured. Please ensure your camera and microphone are sending data and record for at least 2 seconds.',
          });
          setSessionState('error');
          return;
        }

        const mime = recorder.mimeType || selectedMimeTypeRef.current || 'video/webm';
        const blob = new Blob(recordedChunksRef.current, { type: mime });

        if (blob.size === 0) {
          setDiagnosticError({
            stage: 'finalizing',
            errorName: 'ZeroByteBlobError',
            message: 'Recording produced a 0-byte file. The encoder received no frames.',
          });
          setSessionState('error');
          return;
        }

        const url = URL.createObjectURL(blob);
        const duration =
          recordedSecondsRef.current > 0
            ? recordedSecondsRef.current
            : Math.max(1, Math.round((Date.now() - recordingStartTimeRef.current) / 1000));

        setRecordedTake({
          blob,
          url,
          durationSeconds: duration,
          sizeBytes: blob.size,
          mimeType: mime,
          timestamp: Date.now(),
        });

        setSessionState('completed');
        setIsPrompterScrolling(false);
      };

      // Start recording (without timeslice to ensure container integrity across Safari and Chrome)
      recorder.start();
      setSessionState('recording');
      setRecordedSeconds(0);
      recordedSecondsRef.current = 0;
      recordingStartTimeRef.current = Date.now();

      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = window.setInterval(() => {
        setRecordedSeconds((prev) => {
          const next = prev + 1;
          recordedSecondsRef.current = next;
          return next;
        });
      }, 1000);

      // Trigger prompter scroll if configured
      if (autoScrollWithRecord) {
        setIsPrompterScrolling(true);
      }
    } catch (err: unknown) {
      const error = err as { name?: string; message?: string };
      setDiagnosticError({
        stage: 'media-recorder-init',
        errorName: error.name || 'MediaRecorderInitializationError',
        message: 'Failed to initialize the browser video recorder.',
        technicalDetails: error.message || String(err),
      });
      setSessionState('error');
    }
  };

  // Start recording with optional preparation countdown
  const handleStartRecording = () => {
    if (sessionState !== 'ready') return;

    if (recordedTake?.url) {
      URL.revokeObjectURL(recordedTake.url);
      setRecordedTake(null);
    }

    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }

    const countdown = settings.countdownSeconds > 0 ? settings.countdownSeconds : 0;
    if (countdown === 0) {
      executeStartRecording();
      return;
    }

    setSessionState('countdown');
    setRecordingCountdown(countdown);

    countdownTimerRef.current = window.setInterval(() => {
      setRecordingCountdown((prev) => {
        if (prev <= 1) {
          if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
          }
          executeStartRecording();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handlePauseRecording = () => {
    if (sessionState === 'recording' && mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.pause();
        setSessionState('paused');
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        setIsPrompterScrolling(false);
      } catch (err) {
        console.warn('Error pausing recorder:', err);
      }
    }
  };

  const handleResumeRecording = () => {
    if (sessionState === 'paused' && mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      try {
        mediaRecorderRef.current.resume();
        setSessionState('recording');
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = window.setInterval(() => {
          setRecordedSeconds((prev) => {
            const next = prev + 1;
            recordedSecondsRef.current = next;
            return next;
          });
        }, 1000);

        if (autoScrollWithRecord) {
          setIsPrompterScrolling(true);
        }
      } catch (err) {
        console.warn('Error resuming recorder:', err);
      }
    }
  };

  const handleStopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;

    // Transition state immediately to prevent duplicate stop triggers
    setSessionState('finalizing');

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsPrompterScrolling(false);

    try {
      recorder.stop();
    } catch (err) {
      console.error('Error stopping recorder:', err);
    }
  };

  const handleDownloadRecording = () => {
    if (!recordedTake) return;
    const isMp4 = recordedTake.mimeType.toLowerCase().includes('mp4');
    const ext = isMp4 ? 'mp4' : 'webm';
    const cleanTitle =
      scriptTitle
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'studio-take';
    const filename = `${cleanTitle}-recording.${ext}`;

    const a = document.createElement('a');
    a.href = recordedTake.url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleRecordNewTake = () => {
    if (recordedTake?.url) {
      URL.revokeObjectURL(recordedTake.url);
      setRecordedTake(null);
    }
    setSessionState('ready');
    setRecordedSeconds(0);
    recordedSecondsRef.current = 0;
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
      scrollPosRef.current = 0;
      setPrompterProgress(0);
    }
  };

  const handleExitStudio = () => {
    cleanupMedia();
    onExit();
  };

  // Sound toggle on review player
  const handleToggleReviewAudio = () => {
    const video = reviewVideoNodeRef.current;
    if (!video) return;
    if (video.muted || video.volume === 0) {
      video.muted = false;
      video.volume = 1.0;
      setIsReviewMuted(false);
    } else {
      video.muted = true;
      setIsReviewMuted(true);
    }
  };

  const isEmptyScript = content.trim().length === 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--bg-canvas)] text-[var(--text-primary)] select-none overflow-hidden font-sans transition-colors duration-200">
      {/* Studio Header Bar */}
      <header className="flex items-center justify-between gap-3 px-4 sm:px-6 h-14 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] z-30 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={handleExitStudio}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-control)] hover:bg-[var(--border-subtle)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            title="Exit Recording Studio and return to editor"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Exit Studio</span>
          </button>

          <FlowPromptLogo variant="icon" size={20} className="hidden sm:inline-flex" />

          <div className="flex items-center gap-2 truncate">
            <span className="text-xs font-semibold text-[var(--text-primary)] truncate max-w-[140px] sm:max-w-xs">
              {scriptTitle}
            </span>
            <span className="text-xs text-[var(--text-muted)] font-mono hidden md:inline">
              · {stats.words} words
            </span>
          </div>
        </div>

        {/* Center: Recording Status & Elapsed Clock */}
        <div className="flex items-center gap-2">
          {sessionState === 'recording' && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-red-500/15 border border-red-500/35 text-red-500 dark:text-red-300 text-xs font-mono tabular-nums font-semibold animate-pulse">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span>REC {formatClockTimer(recordedSeconds)}</span>
            </div>
          )}
          {sessionState === 'paused' && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-[#FF6A00]/15 border border-[#FF6A00]/35 text-[#FF6A00] dark:text-[#FF8A32] text-xs font-mono tabular-nums font-semibold">
              <Pause className="w-3 h-3" />
              <span>PAUSED {formatClockTimer(recordedSeconds)}</span>
            </div>
          )}
          {sessionState === 'finalizing' && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-[#FF6A00]/15 border border-[#FF6A00]/35 text-[#FF6A00] text-xs font-mono font-semibold">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>FINALIZING TAKE...</span>
            </div>
          )}
          {sessionState === 'ready' && (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/25">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>{hasAudioTrack ? 'Video & Audio Ready' : 'Video Ready (No Mic)'}</span>
              </span>
            </div>
          )}
        </div>

        {/* Right: Layout Switcher, Mirror Toggle & Theme Switcher */}
        <div className="flex items-center gap-2">
          {/* Refresh Hardware Devices Button */}
          {sessionState === 'ready' && (
            <button
              type="button"
              onClick={() => initializeMedia(selectedVideoDeviceId, selectedAudioDeviceId)}
              className="p-2 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-control)] transition-colors cursor-pointer"
              title="Refresh Camera & Microphone stream"
              aria-label="Refresh Media Devices"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}

          {/* Device Settings Popover Toggle */}
          {sessionState === 'ready' && (
            <button
              type="button"
              onClick={() => setShowDeviceSettings((prev) => !prev)}
              className={`p-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                showDeviceSettings
                  ? 'bg-[#FF6A00]/15 text-[#FF6A00] dark:text-[#FF8A32] border border-[#FF6A00]/35'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-control)]'
              }`}
              title="Camera & Microphone Hardware Settings"
              aria-label="Toggle Device Settings"
            >
              <Sliders className="w-4 h-4" />
            </button>
          )}

          {/* Segmented Layout Toggle */}
          <div className="flex items-center gap-1 p-0.5 bg-[var(--bg-control)] rounded-lg border border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={() => setLayoutMode('eye-contact')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                layoutMode === 'eye-contact'
                  ? 'bg-[#FF6A00] text-white shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
              title="Camera centered on top for natural eye contact with the prompter below"
            >
              Eye-Contact
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('split')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                layoutMode === 'split'
                  ? 'bg-[#FF6A00] text-white shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
              title="Side-by-side camera and teleprompter view"
            >
              Split View
            </button>
          </div>

          {/* Mirror Preview Toggle */}
          <button
            type="button"
            onClick={() => setPreviewMirrored((prev) => !prev)}
            className={`p-2 rounded-lg transition-colors cursor-pointer ${
              previewMirrored
                ? 'bg-[#FF6A00]/15 text-[#FF6A00] dark:text-[#FF8A32] border border-[#FF6A00]/35'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-control)]'
            }`}
            title="Mirror preview display (does not flip recorded video)"
            aria-label="Toggle camera preview mirror"
          >
            <FlipHorizontal className="w-4 h-4" />
          </button>

          {/* Theme Toggle */}
          {onToggleTheme && (
            <button
              type="button"
              onClick={onToggleTheme}
              className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-control)] transition-colors cursor-pointer"
              title={
                theme === 'dark'
                  ? 'Switch to Warm Off-White Light Mode'
                  : 'Switch to Deep Charcoal Dark Mode'
              }
              aria-label="Toggle studio theme"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-[#FF8A32]" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </header>

      {/* Main Studio Viewport */}
      {sessionState === 'idle' ? (
        /* Permission Onboarding Screen — Asks user to allow camera & mic access and start */
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-lg mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-[#FF6A00]/10 border border-[#FF6A00]/25 flex items-center justify-center mb-5 text-[#FF6A00] shadow-sm">
            <Video className="w-8 h-8" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)] mb-2">
            Allow Camera & Microphone Access
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed mb-6">
            FLOWPROMPT needs permission to access your webcam and microphone to record high-quality video while you read your teleprompter script. All media stays 100% private on your machine.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-center">
            <button
              type="button"
              onClick={() => initializeMedia()}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold bg-[#FF6A00] hover:bg-[#FF8A32] active:scale-[0.98] text-white transition-all shadow-md cursor-pointer w-full sm:w-auto"
            >
              <Video className="w-4 h-4" />
              <span>Allow Access & Start Studio</span>
            </button>
            <button
              type="button"
              onClick={handleExitStudio}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-control)] hover:bg-[var(--border-subtle)] transition-colors cursor-pointer w-full sm:w-auto"
            >
              <span>Back to Editor</span>
            </button>
          </div>

          <div className="mt-8 p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-left text-xs text-[var(--text-muted)] w-full space-y-2">
            <div className="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
              <HelpCircle className="w-4 h-4 text-[#FF6A00]" />
              <span>How permissions work:</span>
            </div>
            <p className="leading-relaxed">
              Click the button above to trigger the browser prompt. When asked by your browser, click <strong className="text-[var(--text-primary)]">Allow</strong>. You can change camera or microphone devices anytime inside the studio.
            </p>
          </div>
        </div>
      ) : sessionState === 'requesting-permission' ? (
        /* Connecting / Waiting for browser prompt response */
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-lg mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-[#FF6A00]/10 border border-[#FF6A00]/25 flex items-center justify-center mb-5 text-[#FF6A00] animate-pulse">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)] mb-2">
            Waiting for Permission...
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed mb-6">
            Please click <strong className="text-[var(--text-primary)]">Allow</strong> on the prompt appearing near your browser address bar.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-center">
            <button
              type="button"
              onClick={() => initializeMedia()}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#FF6A00] hover:bg-[#FF8A32] text-white transition-all shadow-md cursor-pointer w-full sm:w-auto"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Click to Re-trigger Prompt</span>
            </button>
            <button
              type="button"
              onClick={handleExitStudio}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-control)] hover:bg-[var(--border-subtle)] transition-colors cursor-pointer w-full sm:w-auto"
            >
              <span>Cancel & Back</span>
            </button>
          </div>

          <p className="text-[11px] text-[var(--text-muted)] mt-5">
            If no prompt appeared, look for a camera or lock icon in your browser address bar and choose &quot;Always allow&quot;.
          </p>
        </div>
      ) : sessionState === 'error' && diagnosticError ? (
        /* Explicit Diagnostic Error Screen */
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-lg mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-5 text-red-500">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)] mb-2">
            Recording Error Encountered
          </h1>

          {/* Diagnostic Card */}
          <div className="w-full bg-red-950/80 border border-red-500/40 rounded-2xl p-5 text-left text-xs text-red-200 mb-6 shadow-xl space-y-2">
            <div className="flex items-center justify-between border-b border-red-500/30 pb-2">
              <span className="font-mono text-red-300 font-semibold uppercase tracking-wider text-[10px]">
                Stage: [{diagnosticError.stage}]
              </span>
              <span className="font-mono text-red-400 font-bold">
                {diagnosticError.errorName}
              </span>
            </div>
            <p className="text-red-100 font-medium leading-relaxed pt-1">
              {diagnosticError.message}
            </p>
            {diagnosticError.technicalDetails && (
              <p className="text-[11px] font-mono text-red-300/80 bg-red-950/90 p-2 rounded-lg border border-red-900/50 break-words">
                Details: {diagnosticError.technicalDetails}
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-center">
            <button
              type="button"
              onClick={() => initializeMedia()}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-semibold bg-[#FF6A00] hover:bg-[#FF8A32] text-white transition-all shadow-md active:scale-[0.98] cursor-pointer w-full sm:w-auto"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Connection</span>
            </button>
            <button
              type="button"
              onClick={handleExitStudio}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-control)] hover:bg-[var(--border-subtle)] transition-colors cursor-pointer w-full sm:w-auto"
            >
              <span>Back to Editor</span>
            </button>
          </div>
        </div>
      ) : sessionState === 'completed' && recordedTake ? (
        /* Completed Take Playback & Download Screen */
        <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto">
          <div className="max-w-2xl w-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-[#FF6A00]" />
                <h2 className="text-base font-semibold text-[var(--text-primary)]">
                  Take Recorded Successfully
                </h2>
              </div>
              <div className="text-xs font-mono text-[var(--text-muted)] tabular-nums">
                {formatClockTimer(recordedTake.durationSeconds)} ·{' '}
                {(recordedTake.sizeBytes / (1024 * 1024)).toFixed(1)} MB
              </div>
            </div>

            {/* Video Player with Audio Verification */}
            <div className="relative aspect-video rounded-xl overflow-hidden bg-black border border-[var(--border-subtle)] shadow-inner">
              <video
                key={recordedTake.url}
                ref={(node) => {
                  reviewVideoNodeRef.current = node;
                  if (node) {
                    node.muted = false;
                    node.volume = 1.0;
                  }
                }}
                src={recordedTake.url}
                controls
                playsInline
                autoPlay={false}
                preload="auto"
                className="w-full h-full object-contain"
              />

              {/* Sound Verification Button */}
              <div className="absolute top-3 right-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleReviewAudio}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/80 backdrop-blur-md text-white text-xs font-medium hover:bg-black transition-colors cursor-pointer"
                  title="Test audio playback sound"
                >
                  {isReviewMuted ? (
                    <>
                      <VolumeX className="w-3.5 h-3.5 text-red-400" />
                      <span>Unmute Audio</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-3.5 h-3.5 text-[#FF8A32]" />
                      <span>Audio Active</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Take Metadata & Download Actions */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <div className="text-xs text-[var(--text-muted)] font-mono space-y-0.5">
                <div>Format: {recordedTake.mimeType.split(';')[0]}</div>
                <div className="text-[11px] text-stone-400">
                  {hasAudioTrack ? 'Video + Microphone recorded' : 'Video only recorded'}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleRecordNewTake}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium border border-[var(--border-subtle)] hover:bg-[var(--bg-control)] text-[var(--text-primary)] transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Record New Take</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadRecording}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold bg-[#FF6A00] hover:bg-[#FF8A32] text-white transition-all shadow-sm cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Recording</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Active Recording Studio (Ready / Countdown / Recording / Paused / Finalizing) */
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
          {/* Preparation Countdown Overlay */}
          {sessionState === 'countdown' && (
            <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-[#171717]/85 backdrop-blur-xs">
              <p className="text-xs font-medium text-zinc-400 mb-2">
                Get ready — recording starts in
              </p>
              <div className="text-8xl sm:text-9xl font-bold font-mono tabular-nums text-[#FF6A00] mb-6">
                {recordingCountdown}
              </div>
              <button
                type="button"
                onClick={() => {
                  if (countdownTimerRef.current) {
                    clearInterval(countdownTimerRef.current);
                    countdownTimerRef.current = null;
                  }
                  setRecordingCountdown(0);
                  executeStartRecording();
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#FF6A00] hover:bg-[#FF8A32] text-white transition-colors cursor-pointer shadow-md"
              >
                Start Immediately
              </button>
            </div>
          )}

          {/* Quick Hardware Controls Bar when toggled */}
          {showDeviceSettings && (
            <div className="absolute top-0 inset-x-0 z-30 bg-[var(--bg-elevated)] border-b border-[var(--border-strong)] p-3 shadow-lg flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-[var(--text-muted)] font-medium">Camera:</span>
                  <select
                    value={selectedVideoDeviceId}
                    disabled={sessionState === 'recording' || sessionState === 'finalizing'}
                    onChange={(e) => handleSelectVideoDevice(e.target.value)}
                    className="bg-[var(--bg-subtle)] border border-[var(--border-subtle)] rounded-lg px-2 py-1 text-[var(--text-primary)] focus:outline-none focus:border-[#FF6A00] max-w-xs disabled:opacity-50"
                  >
                    {videoDevices.map((d, i) => (
                      <option key={d.deviceId || i} value={d.deviceId}>
                        {d.label || `Camera ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[var(--text-muted)] font-medium">Mic:</span>
                  <select
                    value={selectedAudioDeviceId}
                    disabled={sessionState === 'recording' || sessionState === 'finalizing'}
                    onChange={(e) => handleSelectAudioDevice(e.target.value)}
                    className="bg-[var(--bg-subtle)] border border-[var(--border-subtle)] rounded-lg px-2 py-1 text-[var(--text-primary)] focus:outline-none focus:border-[#FF6A00] max-w-xs disabled:opacity-50"
                  >
                    {audioDevices.map((d, i) => (
                      <option key={d.deviceId || i} value={d.deviceId}>
                        {d.label || `Microphone ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 cursor-pointer text-[var(--text-secondary)]">
                  <input
                    type="checkbox"
                    checked={autoScrollWithRecord}
                    onChange={(e) => setAutoScrollWithRecord(e.target.checked)}
                    className="accent-[#FF6A00]"
                  />
                  <span>Auto-scroll prompter on REC</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowDeviceSettings(false)}
                  className="px-2 py-1 rounded bg-[var(--bg-control)] text-[var(--text-primary)] hover:bg-[var(--border-subtle)] cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {/* Hardware Track Diagnostic Warning Banner */}
          {trackWarning && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 max-w-lg w-[90%] bg-amber-500/20 border border-amber-500/50 backdrop-blur-md text-amber-900 dark:text-amber-200 px-3.5 py-2 rounded-xl text-xs flex items-center justify-between gap-2 shadow-lg">
              <div className="flex items-center gap-2 min-w-0">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="leading-tight">{trackWarning}</span>
              </div>
              <button
                type="button"
                onClick={() => setTrackWarning(null)}
                className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 hover:underline shrink-0 cursor-pointer ml-2"
              >
                Dismiss
              </button>
            </div>
          )}

          {layoutMode === 'eye-contact' ? (
            /* Eye-Contact Layout: Camera anchored at top center, Teleprompter scrolling below */
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              {/* Top Camera Anchor Container (Centered directly beneath physical webcam lens) */}
              <div className="bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)] py-3 px-4 flex flex-col items-center shrink-0">
                <div className="relative w-56 sm:w-72 aspect-video rounded-xl overflow-hidden border border-[var(--border-strong)] shadow-xl bg-black">
                  <video
                    ref={setVideoPreviewRef}
                    autoPlay
                    playsInline
                    muted
                    style={{ transform: previewMirrored ? 'scaleX(-1)' : 'none' }}
                    className="w-full h-full object-cover"
                  />

                  {/* Camera Off Overlay */}
                  {isCameraOff && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 text-zinc-400 gap-1.5 z-10">
                      <VideoOff className="w-6 h-6 text-zinc-500" />
                      <span className="text-[11px] font-mono">Camera Paused</span>
                    </div>
                  )}

                  {/* Top Bar inside Preview: Camera & Mic Toggles */}
                  <div className="absolute top-2 right-2 flex items-center gap-1 z-20">
                    <button
                      type="button"
                      onClick={handleToggleCamera}
                      className={`p-1.5 rounded-md backdrop-blur-md transition-colors cursor-pointer ${
                        isCameraOff
                          ? 'bg-red-500/80 text-white'
                          : 'bg-black/60 text-zinc-200 hover:text-white'
                      }`}
                      title={isCameraOff ? 'Turn Camera On' : 'Turn Camera Off'}
                    >
                      {isCameraOff ? <VideoOff className="w-3 h-3" /> : <Video className="w-3 h-3" />}
                    </button>
                    <button
                      type="button"
                      onClick={handleToggleMic}
                      className={`p-1.5 rounded-md backdrop-blur-md transition-colors cursor-pointer ${
                        isMicMuted
                          ? 'bg-red-500/80 text-white'
                          : 'bg-black/60 text-zinc-200 hover:text-white'
                      }`}
                      title={isMicMuted ? 'Unmute Microphone' : 'Mute Microphone'}
                    >
                      {isMicMuted ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                    </button>
                  </div>

                  {/* Subtle Camera Framing Eye-Line Label & Mic Level */}
                  <div className="absolute inset-x-0 bottom-0 px-2.5 py-1 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between text-[10px] text-stone-200 font-mono z-20">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#FF6A00]" />
                      <span>Lens Anchor</span>
                    </span>
                    {/* Live Mic Volume Level Meter */}
                    <div className="flex items-center gap-1">
                      {isMicMuted ? (
                        <span className="text-red-400 text-[9px]">MUTED</span>
                      ) : !hasAudioTrack ? (
                        <span className="text-amber-400 text-[9px]">NO MIC</span>
                      ) : (
                        <>
                          <Mic className="w-2.5 h-2.5 text-stone-400" />
                          <div className="w-12 h-1.5 bg-stone-800 rounded-full overflow-hidden">
                            <div
                              style={{ width: `${micVolume}%` }}
                              className="h-full bg-[#FF6A00] transition-all duration-75"
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Scrolling Teleprompter Area immediately below Camera */}
              <div
                ref={scrollContainerRef}
                onScroll={handleManualPrompterScroll}
                className="flex-1 overflow-y-auto no-scrollbar relative px-4 sm:px-8 py-6"
              >
                {/* Visual Reading Guide Overlay */}
                {settings.showReadingGuide && (
                  <div className="sticky top-12 pointer-events-none z-10 -translate-y-1/2 h-20 border-y border-[#FF6A00]/35 bg-[#FF6A00]/[0.04] flex items-center justify-between px-2 sm:px-4">
                    <ChevronRight className="w-5 h-5 text-[#FF6A00]" />
                    <ChevronLeft className="w-5 h-5 text-[#FF6A00]" />
                  </div>
                )}

                <div
                  style={{
                    maxWidth: `${settings.contentWidthPercent}%`,
                    fontSize: `${settings.fontSize}px`,
                    lineHeight: settings.lineHeight,
                    textAlign: settings.textAlign,
                  }}
                  className={`mx-auto pb-64 font-medium tracking-[0.01em] ${
                    settings.fontFamily === 'serif'
                      ? 'font-serif'
                      : settings.fontFamily === 'mono'
                      ? 'font-mono'
                      : 'font-sans'
                  }`}
                >
                  {isEmptyScript ? (
                    <div className="text-center py-12 max-w-md mx-auto space-y-3">
                      <div className="w-10 h-10 rounded-xl bg-[#FF6A00]/10 text-[#FF6A00] flex items-center justify-center mx-auto">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">
                        No script content loaded yet
                      </p>
                      <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                        You can practice speaking freely while recording, or return to the workspace anytime to write or import your script.
                      </p>
                      <button
                        type="button"
                        onClick={handleExitStudio}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#FF6A00] dark:text-[#FF8A32] bg-[#FF6A00]/10 hover:bg-[#FF6A00]/20 cursor-pointer"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Return to Editor</span>
                      </button>
                    </div>
                  ) : (
                    parsedLines.map((line) => {
                      if (line.type === 'heading') {
                        return (
                          <h2
                            key={line.id}
                            style={{ fontSize: `${Math.round(settings.fontSize * 0.72)}px` }}
                            className="font-bold text-[#FF6A00] dark:text-[#FF8A32] mt-8 mb-4 whitespace-pre-wrap break-words"
                          >
                            {line.text}
                          </h2>
                        );
                      }
                      if (line.type === 'cue-pause' || line.type === 'cue-direction') {
                        return (
                          <div key={line.id} className="my-6">
                            <span
                              style={{
                                fontSize: `${Math.max(14, Math.round(settings.fontSize * 0.42))}px`,
                              }}
                              className="inline-block font-mono font-medium px-3 py-1 rounded-lg border border-[#FF6A00]/35 bg-[#FF6A00]/10 text-[#FF6A00] dark:text-[#FF8A32]"
                            >
                              {line.type === 'cue-pause' ? `⏱ ${line.text}` : `• ${line.text}`}
                            </span>
                          </div>
                        );
                      }
                      return (
                        <p key={line.id} className="mb-8 whitespace-pre-wrap break-words">
                          {line.text}
                        </p>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Split Studio Layout: Camera on Left, Teleprompter on Right */
            <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden">
              {/* Left Column: Camera Studio Preview & Controls */}
              <div className="w-full md:w-1/2 p-4 sm:p-6 flex flex-col border-b md:border-b-0 md:border-r border-[var(--border-subtle)] bg-[var(--bg-elevated)] overflow-y-auto">
                <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-[var(--border-strong)] shadow-xl bg-black mb-4 shrink-0">
                  <video
                    ref={setVideoPreviewRef}
                    autoPlay
                    playsInline
                    muted
                    style={{ transform: previewMirrored ? 'scaleX(-1)' : 'none' }}
                    className="w-full h-full object-cover"
                  />

                  {/* Camera Off Overlay */}
                  {isCameraOff && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 text-zinc-400 gap-2 z-10">
                      <VideoOff className="w-8 h-8 text-zinc-500" />
                      <span className="text-xs font-mono">Camera Paused</span>
                    </div>
                  )}

                  {/* Top Bar inside Preview: Camera & Mic Toggles */}
                  <div className="absolute top-3 right-3 flex items-center gap-1.5 z-20">
                    <button
                      type="button"
                      onClick={handleToggleCamera}
                      className={`p-2 rounded-lg backdrop-blur-md transition-colors cursor-pointer ${
                        isCameraOff
                          ? 'bg-red-500/80 text-white'
                          : 'bg-black/60 text-zinc-200 hover:text-white'
                      }`}
                      title={isCameraOff ? 'Turn Camera On' : 'Turn Camera Off'}
                    >
                      {isCameraOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={handleToggleMic}
                      className={`p-2 rounded-lg backdrop-blur-md transition-colors cursor-pointer ${
                        isMicMuted
                          ? 'bg-red-500/80 text-white'
                          : 'bg-black/60 text-zinc-200 hover:text-white'
                      }`}
                      title={isMicMuted ? 'Unmute Microphone' : 'Mute Microphone'}
                    >
                      {isMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Live Volume Meter on preview */}
                  <div className="absolute bottom-3 left-3 flex items-center gap-2 px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-xs text-[11px] text-stone-200 font-mono z-20">
                    {isMicMuted ? (
                      <span className="text-red-400 text-xs">Mic Muted</span>
                    ) : !hasAudioTrack ? (
                      <span className="text-amber-400 text-xs">No Mic Connected</span>
                    ) : (
                      <>
                        <Mic className="w-3.5 h-3.5 text-stone-400" />
                        <span>Mic Level</span>
                        <div className="w-16 h-2 bg-stone-800 rounded-full overflow-hidden">
                          <div
                            style={{ width: `${micVolume}%` }}
                            className="h-full bg-[#FF6A00] transition-all duration-75"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Device Selector Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs mb-4">
                  <div>
                    <label className="text-[var(--text-muted)] block mb-1">
                      Camera Input
                    </label>
                    <select
                      value={selectedVideoDeviceId}
                      disabled={sessionState === 'recording' || sessionState === 'finalizing'}
                      onChange={(e) => handleSelectVideoDevice(e.target.value)}
                      className="w-full bg-[var(--bg-subtle)] border border-[var(--border-subtle)] rounded-lg px-2.5 py-1.5 text-[var(--text-primary)] focus:outline-none focus:border-[#FF6A00] disabled:opacity-50"
                    >
                      {videoDevices.map((d, i) => (
                        <option key={d.deviceId || i} value={d.deviceId}>
                          {d.label || `Camera ${i + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[var(--text-muted)] block mb-1">
                      Microphone Input
                    </label>
                    <select
                      value={selectedAudioDeviceId}
                      disabled={sessionState === 'recording' || sessionState === 'finalizing'}
                      onChange={(e) => handleSelectAudioDevice(e.target.value)}
                      className="w-full bg-[var(--bg-subtle)] border border-[var(--border-subtle)] rounded-lg px-2.5 py-1.5 text-[var(--text-primary)] focus:outline-none focus:border-[#FF6A00] disabled:opacity-50"
                    >
                      {audioDevices.map((d, i) => (
                        <option key={d.deviceId || i} value={d.deviceId}>
                          {d.label || `Microphone ${i + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Toggle auto-scroll with record */}
                <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--text-secondary)]">
                  <input
                    type="checkbox"
                    checked={autoScrollWithRecord}
                    onChange={(e) => setAutoScrollWithRecord(e.target.checked)}
                    className="accent-[#FF6A00]"
                  />
                  <span>Auto-scroll prompter text when recording starts</span>
                </label>
              </div>

              {/* Right Column: Teleprompter Reading View */}
              <div
                ref={scrollContainerRef}
                onScroll={handleManualPrompterScroll}
                className="w-full md:w-1/2 overflow-y-auto no-scrollbar relative p-6 sm:p-10"
              >
                {/* Visual Reading Guide Overlay */}
                {settings.showReadingGuide && (
                  <div className="sticky top-20 pointer-events-none z-10 -translate-y-1/2 h-20 border-y border-[#FF6A00]/35 bg-[#FF6A00]/[0.04] flex items-center justify-between px-2 sm:px-4">
                    <ChevronRight className="w-5 h-5 text-[#FF6A00]" />
                    <ChevronLeft className="w-5 h-5 text-[#FF6A00]" />
                  </div>
                )}

                <div
                  style={{
                    fontSize: `${settings.fontSize}px`,
                    lineHeight: settings.lineHeight,
                    textAlign: settings.textAlign,
                  }}
                  className={`mx-auto pb-64 font-medium tracking-[0.01em] ${
                    settings.fontFamily === 'serif'
                      ? 'font-serif'
                      : settings.fontFamily === 'mono'
                      ? 'font-mono'
                      : 'font-sans'
                  }`}
                >
                  {isEmptyScript ? (
                    <div className="text-center py-12 max-w-md mx-auto space-y-3">
                      <div className="w-10 h-10 rounded-xl bg-[#FF6A00]/10 text-[#FF6A00] flex items-center justify-center mx-auto">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">
                        No script content loaded yet
                      </p>
                      <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                        You can practice speaking freely while recording, or return to the workspace anytime to write or import your script.
                      </p>
                      <button
                        type="button"
                        onClick={handleExitStudio}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#FF6A00] dark:text-[#FF8A32] bg-[#FF6A00]/10 hover:bg-[#FF6A00]/20 cursor-pointer"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Return to Editor</span>
                      </button>
                    </div>
                  ) : (
                    parsedLines.map((line) => {
                      if (line.type === 'heading') {
                        return (
                          <h2
                            key={line.id}
                            style={{ fontSize: `${Math.round(settings.fontSize * 0.72)}px` }}
                            className="font-bold text-[#FF6A00] dark:text-[#FF8A32] mt-8 mb-4 whitespace-pre-wrap break-words"
                          >
                            {line.text}
                          </h2>
                        );
                      }
                      if (line.type === 'cue-pause' || line.type === 'cue-direction') {
                        return (
                          <div key={line.id} className="my-6">
                            <span
                              style={{
                                fontSize: `${Math.max(14, Math.round(settings.fontSize * 0.42))}px`,
                              }}
                              className="inline-block font-mono font-medium px-3 py-1 rounded-lg border border-[#FF6A00]/35 bg-[#FF6A00]/10 text-[#FF6A00] dark:text-[#FF8A32]"
                            >
                              {line.type === 'cue-pause' ? `⏱ ${line.text}` : `• ${line.text}`}
                            </span>
                          </div>
                        );
                      }
                      return (
                        <p key={line.id} className="mb-8 whitespace-pre-wrap break-words">
                          {line.text}
                        </p>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Floating Studio Control Console */}
      {(sessionState === 'ready' ||
        sessionState === 'countdown' ||
        sessionState === 'recording' ||
        sessionState === 'paused' ||
        sessionState === 'finalizing') && (
        <footer className="fixed bottom-5 left-1/2 -translate-x-1/2 z-30 max-w-[95vw]">
          <div className="flex items-center gap-2 sm:gap-3 px-4 py-2.5 rounded-2xl bg-[#171717]/95 text-[#FAF9F6] border border-white/15 shadow-2xl backdrop-blur-md overflow-x-auto no-scrollbar">
            {/* Recording Controls: Start / Pause / Resume / Stop */}
            {sessionState === 'ready' && (
              <button
                type="button"
                onClick={handleStartRecording}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-[#FF6A00] hover:bg-[#FF8A32] text-white transition-all shadow-sm cursor-pointer whitespace-nowrap shrink-0"
                title="Start Recording Video & Audio"
              >
                <Circle className="w-3.5 h-3.5 fill-current" />
                <span>Start Recording</span>
              </button>
            )}

            {sessionState === 'countdown' && (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-[#FF6A00]/40 text-white whitespace-nowrap shrink-0">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Starting in {recordingCountdown}...</span>
              </div>
            )}

            {sessionState === 'recording' && (
              <>
                <button
                  type="button"
                  onClick={handlePauseRecording}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[#FF6A00] hover:bg-[#FF8A32] text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  title="Pause Recording"
                >
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  <span>Pause</span>
                </button>
                <button
                  type="button"
                  onClick={handleStopRecording}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-500 text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  title="Stop and Review Recording"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Stop</span>
                </button>
              </>
            )}

            {sessionState === 'paused' && (
              <>
                <button
                  type="button"
                  onClick={handleResumeRecording}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[#FF6A00] hover:bg-[#FF8A32] text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  title="Resume Recording"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Resume</span>
                </button>
                <button
                  type="button"
                  onClick={handleStopRecording}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-500 text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  title="Stop and Review Recording"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Stop</span>
                </button>
              </>
            )}

            {sessionState === 'finalizing' && (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-800 text-zinc-300 whitespace-nowrap shrink-0">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#FF6A00]" />
                <span>Processing Video Take...</span>
              </div>
            )}

            <span aria-hidden="true" className="h-5 w-px bg-white/15 shrink-0" />

            {/* Prompter Scroll Controls */}
            <button
              type="button"
              onClick={() => setIsPrompterScrolling((prev) => !prev)}
              disabled={sessionState === 'finalizing'}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/10 disabled:opacity-40 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              title={isPrompterScrolling ? 'Pause Prompter Scroll' : 'Scroll Prompter'}
            >
              {isPrompterScrolling ? (
                <>
                  <Pause className="w-3 h-3" />
                  <span>Pause Scroll</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3" />
                  <span>Scroll</span>
                </>
              )}
            </button>

            {/* Prompter Speed Adjuster */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => onUpdateSettings({ wpm: Math.max(60, settings.wpm - 5) })}
                className="p-1 rounded text-zinc-300 hover:text-white hover:bg-white/10 cursor-pointer"
                title="Decrease scroll speed"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="font-mono tabular-nums text-xs text-zinc-200 px-1">
                {settings.wpm} WPM
              </span>
              <button
                type="button"
                onClick={() => onUpdateSettings({ wpm: Math.min(260, settings.wpm + 5) })}
                className="p-1 rounded text-zinc-300 hover:text-white hover:bg-white/10 cursor-pointer"
                title="Increase scroll speed"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>

            <span aria-hidden="true" className="h-5 w-px bg-white/15 shrink-0" />

            {/* Font Size Adjuster */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({ fontSize: Math.max(24, settings.fontSize - 4) })
                }
                className="px-1.5 py-0.5 rounded text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/10 cursor-pointer"
                title="Smaller text"
              >
                A-
              </button>
              <span className="font-mono tabular-nums text-xs text-zinc-300">
                {settings.fontSize}
              </span>
              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({ fontSize: Math.min(96, settings.fontSize + 4) })
                }
                className="px-1.5 py-0.5 rounded text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/10 cursor-pointer"
                title="Larger text"
              >
                A+
              </button>
            </div>

            <span aria-hidden="true" className="h-5 w-px bg-white/15 shrink-0" />

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
              title="Toggle Reading Focus Guide"
              aria-label="Toggle Reading Focus Guide"
            >
              <Eye className="w-4 h-4" />
            </button>
          </div>
        </footer>
      )}
    </div>
  );
};
