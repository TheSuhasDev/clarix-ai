import { config, mock, request, requestBlob } from './client';

export interface TranscriptionResponse {
  text: string;
  language: string;
  durationMs: number;
  model: string;
}

export interface TtsStatusResponse {
  engine: string;
  ready: boolean;
  voice: string;
  voiceLoaded: boolean;
  voiceDir: string;
  availableVoices: string[];
  policyEnabled: boolean;
}

export const voiceService = {
  /**
   * Transcribe an audio recording offline via local Whisper (POST /api/voice/transcribe).
   * Audio is processed in memory on the backend and discarded immediately (zero retention).
   */
  transcribe: async (audioBlob: Blob, language?: string): Promise<TranscriptionResponse> => {
    if (!config.useMocks) {
      const form = new FormData();
      const ext = audioBlob.type.includes('wav') ? 'wav' : 'webm';
      form.append('file', audioBlob, `voice_recording.${ext}`);
      if (language) {
        form.append('language', language);
      }
      return request<TranscriptionResponse>(
        '/api/voice/transcribe',
        {
          method: 'POST',
          body: form,
        },
        30000
      );
    }

    return mock<TranscriptionResponse>(
      () => ({
        text: 'Analyze security logs and summarize recent quarantine events.',
        language: language || 'en',
        durationMs: 410,
        model: 'whisper-mock-base',
      }),
      650
    );
  },

  /**
   * Synthesize text to speech offline via local Piper neural TTS (POST /api/voice/speak).
   * Audio is rendered completely in memory as audio/wav and never stored on disk.
   */
  speak: async (text: string, voice?: string, speed?: number): Promise<Blob> => {
    if (!config.useMocks) {
      return requestBlob(
        '/api/voice/speak',
        {
          method: 'POST',
          body: JSON.stringify({
            text,
            voice: voice || undefined,
            speed: typeof speed === 'number' ? speed : 1.0,
          }),
        },
        20000
      );
    }

    // Mock speech: generate a tiny empty audio blob
    return mock<Blob>(() => new Blob([], { type: 'audio/wav' }), 120);
  },

  /**
   * Query TTS readiness and available voices from /health.
   */
  getTtsStatus: async (): Promise<TtsStatusResponse | null> => {
    if (!config.useMocks) {
      try {
        const res = await request<{ tts?: TtsStatusResponse }>('/health', { method: 'GET' }, 4000);
        return res.tts || null;
      } catch {
        return null;
      }
    }
    return {
      engine: 'mock',
      ready: true,
      voice: 'en_US-lessac-low',
      voiceLoaded: true,
      voiceDir: 'mock://local',
      availableVoices: ['en_US-lessac-low'],
      policyEnabled: true,
    };
  },
};
