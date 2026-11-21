import { useCallback, useEffect, useRef, useState } from 'react';
import { voiceService, type TranscriptionResponse } from '../services';

export interface VoiceRecorderState {
  recording: boolean;
  transcribing: boolean;
  duration: number;
  waveform: number[];
  error: string | null;
  stagingSteps: string[] | null;
}

export function useVoiceRecorder(onTranscribed: (text: string, meta: TranscriptionResponse) => void) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [duration, setDuration] = useState(0);
  const [waveform, setWaveform] = useState<number[]>(new Array(16).fill(0.1));
  const [error, setError] = useState<string | null>(null);
  const [stagingSteps, setStagingSteps] = useState<string[] | null>(null);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const timerRef = useRef<any>(null);
  const chunksRef = useRef<Blob[]>([]);

  const cleanupAudio = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        void audioContextRef.current.close();
      } catch {
        // ignore
      }
      audioContextRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    analyserRef.current = null;
    setWaveform(new Array(16).fill(0.1));
  }, []);

  const stopRecording = useCallback(async () => {
    if (!recording || !mediaRecorderRef.current) return;

    return new Promise<void>((resolve) => {
      const rec = mediaRecorderRef.current;
      if (!rec || rec.state === 'inactive') {
        cleanupAudio();
        setRecording(false);
        resolve();
        return;
      }

      rec.onstop = async () => {
        cleanupAudio();
        setRecording(false);
        const mimeType = rec.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];

        if (blob.size === 0) {
          setError('No audio captured. Please check your microphone.');
          resolve();
          return;
        }

        setTranscribing(true);
        setError(null);
        setStagingSteps(null);

        try {
          const res = await voiceService.transcribe(blob);
          if (res.text && res.text.trim()) {
            onTranscribed(res.text.trim(), res);
          } else {
            setError('No speech recognized in audio clip.');
          }
        } catch (e: any) {
          const msg = e?.message || 'Voice transcription failed.';
          setError(msg);
          if (e?.stagingSteps && Array.isArray(e.stagingSteps)) {
            setStagingSteps(e.stagingSteps);
          }
        } finally {
          setTranscribing(false);
          resolve();
        }
      };

      try {
        rec.stop();
      } catch {
        cleanupAudio();
        setRecording(false);
        resolve();
      }
    });
  }, [recording, cleanupAudio, onTranscribed]);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.onstop = null;
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    chunksRef.current = [];
    cleanupAudio();
    setRecording(false);
    setTranscribing(false);
    setDuration(0);
  }, [cleanupAudio]);

  const startRecording = useCallback(async () => {
    setError(null);
    setStagingSteps(null);

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('Audio recording is not supported in this browser environment.');
      return;
    }

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
      } catch (err: any) {
        // Fallback to basic audio constraint if strict constraints fail
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      mediaStreamRef.current = stream;

      // AudioContext analyser for live waveform
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          const actx = new AudioContextClass();
          if (actx.state === 'suspended') {
            void actx.resume();
          }
          audioContextRef.current = actx;
          const source = actx.createMediaStreamSource(stream);
          const analyser = actx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);
          analyserRef.current = analyser;

          const pcmData = new Uint8Array(analyser.frequencyBinCount);
          const updateWaveform = () => {
            if (!analyserRef.current) return;
            analyserRef.current.getByteFrequencyData(pcmData);
            // Sample 16 discrete bars
            const bars: number[] = [];
            const step = Math.max(1, Math.floor(pcmData.length / 16));
            for (let i = 0; i < 16; i++) {
              const raw = pcmData[i * step] || 0;
              const norm = Math.max(0.1, Math.min(1.0, raw / 180));
              bars.push(norm);
            }
            setWaveform(bars);
            animFrameRef.current = requestAnimationFrame(updateWaveform);
          };
          animFrameRef.current = requestAnimationFrame(updateWaveform);
        }
      } catch (visErr) {
        console.warn('Audio visualization unavailable, proceeding with recording:', visErr);
      }

      // Select supported audio mime type
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/wav',
      ];
      let selectedMime = '';
      for (const m of mimeTypes) {
        if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) {
          selectedMime = m;
          break;
        }
      }

      const recorder = new MediaRecorder(stream, selectedMime ? { mimeType: selectedMime } : undefined);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.start(250); // Slice chunks every 250ms
      setRecording(true);
      setDuration(0);

      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        const sec = Math.floor((Date.now() - startTime) / 1000);
        setDuration(sec);
        if (sec >= 60) {
          // Hard cap at 60s
          void stopRecording();
        }
      }, 500);
    } catch (err: any) {
      cleanupAudio();
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setError('Microphone permission was denied. Please allow microphone access in your browser settings.');
      } else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
        setError('No microphone was found on this workstation.');
      } else {
        setError(err?.message || 'Failed to initialize audio input.');
      }
    }
  }, [cleanupAudio, stopRecording]);

  const toggleRecording = useCallback(() => {
    if (recording) {
      void stopRecording();
    } else {
      void startRecording();
    }
  }, [recording, startRecording, stopRecording]);

  // Keyboard shortcut Ctrl+Shift+Space to toggle voice recording
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.code === 'Space' || e.key === ' ')) {
        e.preventDefault();
        toggleRecording();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleRecording]);

  // Auto-clear error when microphone permission changes to granted
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'microphone' as any })
        .then((status) => {
          if (status.state === 'granted') {
            setError((prev) => (prev && prev.includes('permission') ? null : prev));
          }
          status.onchange = () => {
            if (status.state === 'granted') {
              setError(null);
            }
          };
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    return () => {
      cleanupAudio();
    };
  }, [cleanupAudio]);

  return {
    recording,
    transcribing,
    duration,
    waveform,
    error,
    stagingSteps,
    clearError: () => {
      setError(null);
      setStagingSteps(null);
    },
    startRecording,
    stopRecording,
    cancelRecording,
    toggleRecording,
  };
}
