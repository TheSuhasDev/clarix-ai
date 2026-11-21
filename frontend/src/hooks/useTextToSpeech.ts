import { useCallback, useEffect, useRef, useState } from 'react';
import { voiceService } from '../services';

const STORAGE_KEY_ENABLED = 'clarix.tts.enabled';
const STORAGE_KEY_SPEED = 'clarix.tts.speed';
const STORAGE_KEY_VOLUME = 'clarix.tts.volume';
const STORAGE_KEY_VOICE = 'clarix.tts.voice';

function safeStorageGet<T>(key: string, fallback: T): T {
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const v = localStorage.getItem(key);
    if (v === null) return fallback;
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}

function safeStorageSet<T>(key: string, value: T): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(value));
    }
  } catch {
    // Ignore storage quota / security errors
  }
}

/**
 * Sanitize text before speech synthesis:
 * Strips markdown, code blocks, URLs, citations [n], and prepends policy/unverified warnings.
 */
export function sanitizeTextForSpeech(
  text: string,
  isUnverified: boolean = false,
  isBlocked: boolean = false
): string {
  if (!text) return '';

  let prefix = '';
  if (isBlocked) {
    prefix = 'Request blocked by policy. ';
  } else if (isUnverified) {
    prefix = 'Warning: this answer could not be fully verified. ';
  }

  // 1. Remove REQ ID trace lines
  let clean = text.replace(/REQ ID:\s*REQ-\d+[\s\S]*?(?=\n\n|$)/gi, ' ');

  // 2. Remove code blocks
  clean = clean.replace(/```[\s\S]*?```/g, ' [Code block omitted] ');

  // 3. Remove inline code backticks
  clean = clean.replace(/`([^`]+)`/g, '$1');

  // 4. Remove markdown links [text](url) -> text
  clean = clean.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');

  // 5. Remove bare URLs
  clean = clean.replace(/https?:\/\/\S+|www\.\S+/gi, ' ');

  // 6. Remove citation markers [1], [42]
  clean = clean.replace(/\[\d{1,3}\]/g, ' ');

  // 7. Remove headers (#) and bullets (-, *, •)
  clean = clean.replace(/^#{1,6}\s+/gm, '');
  clean = clean.replace(/^\s*[\-\*•]\s+/gm, '');

  // 8. Remove formatting markers (*, _, ~)
  clean = clean.replace(/[*_~]/g, '');

  // 9. Normalize whitespace and newlines
  const lines = clean.split('\n').map((l) => l.trim()).filter(Boolean);
  clean = lines.join('. ');
  clean = clean.replace(/\s+/g, ' ').replace(/\.{2,}/g, '.').trim();

  // Cap at 2000 characters
  const combined = `${prefix}${clean}`.trim();
  if (combined.length > 2000) {
    return combined.slice(0, 1990) + '...';
  }
  return combined;
}

export interface UseTextToSpeechReturn {
  enabled: boolean;
  speaking: boolean;
  activeId: string | null;
  speed: number;
  volume: number;
  voice: string;
  backendReady: boolean;
  hasLocalVoice: boolean;
  isAvailable: boolean;
  browserVoices: SpeechSynthesisVoice[];
  backendVoices: string[];
  screenReaderAnnouncement: string;
  toggleEnabled: () => void;
  setSpeed: (speed: number) => void;
  setVolume: (volume: number) => void;
  setVoice: (voice: string) => void;
  speak: (text: string, id?: string, isUnverified?: boolean, isBlocked?: boolean) => Promise<void>;
  stop: () => void;
}

export function useTextToSpeech(onToast?: (msg: string, tone?: 'blue' | 'green' | 'amber' | 'red') => void): UseTextToSpeechReturn {
  const [enabled, setEnabledState] = useState<boolean>(() => safeStorageGet(STORAGE_KEY_ENABLED, false));
  const [speed, setSpeedState] = useState<number>(() => safeStorageGet(STORAGE_KEY_SPEED, 1.0));
  const [volume, setVolumeState] = useState<number>(() => safeStorageGet(STORAGE_KEY_VOLUME, 1.0));
  const [voice, setVoiceState] = useState<string>(() => safeStorageGet(STORAGE_KEY_VOICE, ''));

  const [speaking, setSpeaking] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [backendReady, setBackendReady] = useState(false);
  const [backendVoices, setBackendVoices] = useState<string[]>([]);
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [screenReaderAnnouncement, setScreenReaderAnnouncement] = useState('');

  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  // Load and filter browser voices strictly for localService === true (air-gap safe)
  const refreshBrowserVoices = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setBrowserVoices([]);
      return;
    }
    try {
      const allVoices = window.speechSynthesis.getVoices();
      // Strict Air-Gap Guard: only keep voices where localService === true (offline OS speech engines)
      const offlineOnly = allVoices.filter((v) => v.localService === true);
      setBrowserVoices(offlineOnly);
    } catch {
      setBrowserVoices([]);
    }
  }, []);

  // Check backend Piper TTS status and populate voices
  useEffect(() => {
    voiceService.getTtsStatus().then((status) => {
      if (status && status.ready) {
        setBackendReady(true);
        if (status.availableVoices && status.availableVoices.length > 0) {
          setBackendVoices(status.availableVoices);
          if (!voice) setVoiceState(status.voice || status.availableVoices[0]);
        }
      }
    }).catch(() => undefined);

    refreshBrowserVoices();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = refreshBrowserVoices;
    }
  }, [refreshBrowserVoices, voice]);

  const hasLocalVoice = browserVoices.length > 0;
  const isAvailable = backendReady || hasLocalVoice;

  // Stop playback immediately
  const stop = useCallback(() => {
    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
      } catch {}
      currentAudioRef.current = null;
    }
    if (audioUrlRef.current) {
      try {
        URL.revokeObjectURL(audioUrlRef.current);
      } catch {}
      audioUrlRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    setSpeaking(false);
    setActiveId(null);
  }, []);

  // Toggle global ON/OFF
  const toggleEnabled = useCallback(() => {
    setEnabledState((prev) => {
      const next = !prev;
      safeStorageSet(STORAGE_KEY_ENABLED, next);
      if (!next) {
        stop();
        setScreenReaderAnnouncement('Voice output turned off');
      } else {
        setScreenReaderAnnouncement('Voice output turned on');
      }
      return next;
    });
  }, [stop]);

  const setSpeed = useCallback((s: number) => {
    const val = Math.max(0.75, Math.min(1.5, Math.round(s * 100) / 100));
    setSpeedState(val);
    safeStorageSet(STORAGE_KEY_SPEED, val);
  }, []);

  const setVolume = useCallback((v: number) => {
    const val = Math.max(0.0, Math.min(1.0, Math.round(v * 100) / 100));
    setVolumeState(val);
    safeStorageSet(STORAGE_KEY_VOLUME, val);
  }, []);

  const setVoice = useCallback((v: string) => {
    setVoiceState(v);
    safeStorageSet(STORAGE_KEY_VOICE, v);
  }, []);

  // Keyboard shortcut Ctrl+Shift+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'S' || e.key === 's')) {
        e.preventDefault();
        toggleEnabled();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleEnabled]);

  // Primary speech execution with automatic local fallback
  const speak = useCallback(
    async (rawText: string, id?: string, isUnverified: boolean = false, isBlocked: boolean = false) => {
      const cleaned = sanitizeTextForSpeech(rawText, isUnverified, isBlocked);
      if (!cleaned) return;

      stop();
      setSpeaking(true);
      if (id) setActiveId(id);

      // 1. Try Primary: Backend Piper Neural TTS
      if (backendReady) {
        try {
          const blob = await voiceService.speak(cleaned, voice || undefined, speed);
          if (blob && blob.size > 0) {
            const url = URL.createObjectURL(blob);
            audioUrlRef.current = url;
            const audio = new Audio(url);
            audio.volume = volume;
            currentAudioRef.current = audio;

            audio.onended = () => {
              stop();
            };
            audio.onerror = () => {
              stop();
              // Try fallback to browser speechSynthesis
              playBrowserSpeech(cleaned);
            };
            await audio.play();
            return;
          }
        } catch (err: any) {
          logFallback(err?.message || 'Backend TTS error');
        }
      }

      // 2. Fallback: Browser speechSynthesis with localService === true ONLY
      playBrowserSpeech(cleaned);

      function logFallback(reason: string) {
        if (onToast) onToast(`Backend speech unavailable (${reason}); falling back to local OS voice.`, 'amber');
      }

      function playBrowserSpeech(textToSpeak: string) {
        if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
          stop();
          if (onToast) onToast('Voice output unavailable: no speech engine installed.', 'red');
          return;
        }

        const offlineVoices = window.speechSynthesis.getVoices().filter((v) => v.localService === true);
        if (offlineVoices.length === 0) {
          stop();
          if (onToast) onToast('Voice output unavailable: no offline OS voice found.', 'red');
          return;
        }

        try {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(textToSpeak);
          utterance.rate = speed;
          utterance.volume = volume;

          // Select matching voice if chosen, or first local voice
          const match = offlineVoices.find((v) => v.name === voice) || offlineVoices[0];
          if (match) utterance.voice = match;

          utterance.onend = () => {
            stop();
          };
          utterance.onerror = () => {
            stop();
          };

          window.speechSynthesis.speak(utterance);
        } catch {
          stop();
        }
      }
    },
    [backendReady, voice, speed, volume, stop, onToast]
  );

  return {
    enabled,
    speaking,
    activeId,
    speed,
    volume,
    voice,
    backendReady,
    hasLocalVoice,
    isAvailable,
    browserVoices,
    backendVoices,
    screenReaderAnnouncement,
    toggleEnabled,
    setSpeed,
    setVolume,
    setVoice,
    speak,
    stop,
  };
}
