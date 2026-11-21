"""Voice Manager: orchestrates transcription, text-to-speech synthesis, policies, and audit logging."""
from __future__ import annotations

import concurrent.futures
import logging
import time
from pathlib import Path
from typing import Any

from .audio_util import validate_audio
from .errors import (
    AudioDurationExceededError,
    AudioSizeExceededError,
    InvalidAudioError,
    ModelNotFoundError,
    TextLengthExceededError,
    VoiceDisabledError,
    VoiceError,
    VoiceNotFoundError,
    VoiceOutputDisabledError,
)
from .synthesizer import BaseSynthesizer, MockSynthesizer, PiperSynthesizer
from .transcriber import BaseTranscriber, FasterWhisperTranscriber, MockTranscriber
from .tts_sanitizer import clean_text_for_speech

log = logging.getLogger("clarix.voice")


class VoiceManager:
    """Manages offline speech-to-text (STT) and text-to-speech (TTS) requests."""

    def __init__(
        self,
        ctx,
        transcriber: BaseTranscriber | None = None,
        synthesizer: BaseSynthesizer | None = None,
    ):
        self.ctx = ctx
        self._executor = concurrent.futures.ThreadPoolExecutor(max_workers=2, thread_name_prefix="clarix-voice")

        # 1. Transcriber setup (Whisper STT)
        if transcriber is not None:
            self.transcriber = transcriber
        else:
            model_dir = getattr(ctx.settings, "whisper_model_dir", None)
            if not model_dir:
                model_dir = ctx.settings.data_dir / "models" / "whisper"
                if not model_dir.exists():
                    model_dir = Path("./models/whisper")

            model_name = getattr(ctx.settings, "whisper_model", "base")
            language = getattr(ctx.settings, "whisper_language", None)

            self.transcriber = FasterWhisperTranscriber(
                model_dir=model_dir,
                model_name=model_name,
                default_language=language,
            )

        # 2. Synthesizer setup (Piper TTS)
        if synthesizer is not None:
            self.synthesizer = synthesizer
        else:
            tts_engine = getattr(ctx.settings, "tts_engine", "piper")
            tts_dir = getattr(ctx.settings, "tts_voice_dir", None)
            candidates = [
                tts_dir,
                ctx.settings.data_dir / "models" / "piper",
                Path("./models/piper"),
                Path("../models/piper"),
                Path(__file__).resolve().parents[3] / "models" / "piper",
            ]
            chosen_dir = Path("./models/piper")
            for cand in candidates:
                if cand and Path(cand).is_dir():
                    chosen_dir = Path(cand)
                    break

            default_voice = getattr(ctx.settings, "tts_voice", "en_US-lessac-low")

            if tts_engine == "mock":
                self.synthesizer = MockSynthesizer(default_voice=default_voice)
            else:
                self.synthesizer = PiperSynthesizer(
                    voice_dir=chosen_dir,
                    default_voice=default_voice,
                )

    def is_policy_enabled(self) -> bool:
        """Check whether voice input policy (POL-006) is active."""
        if hasattr(self.ctx, "policy"):
            enabled_pols = self.ctx.policy.enabled()
            if "POL-006" in enabled_pols:
                return True
            all_pols = {p["id"] for p in self.ctx.policy.view()}
            if "POL-006" in all_pols and "POL-006" not in enabled_pols:
                return False
        return getattr(self.ctx.settings, "voice_enabled", True)

    def is_tts_policy_enabled(self) -> bool:
        """Check whether voice output policy (POL-007) is active."""
        if hasattr(self.ctx, "policy"):
            enabled_pols = self.ctx.policy.enabled()
            if "POL-007" in enabled_pols:
                return True
            all_pols = {p["id"] for p in self.ctx.policy.view()}
            if "POL-007" in all_pols and "POL-007" not in enabled_pols:
                return False
        return getattr(self.ctx.settings, "tts_enabled", True)

    def get_status(self) -> dict[str, Any]:
        """STT subsystem status reported to /health and /api/health."""
        info = self.transcriber.get_status()
        info["policyEnabled"] = self.is_policy_enabled()
        return info

    def get_tts_status(self) -> dict[str, Any]:
        """TTS subsystem status reported to /health and /api/health."""
        info = self.synthesizer.get_status()
        info["policyEnabled"] = self.is_tts_policy_enabled()
        return info

    def transcribe(
        self,
        audio_bytes: bytes,
        user: str = "operator",
        language: str | None = None,
    ) -> dict[str, Any]:
        """
        Validate and transcribe audio blob in worker thread.
        Writes audit record with METADATA ONLY (never persists audio).
        """
        if not self.is_policy_enabled():
            raise VoiceDisabledError("Voice input policy (POL-006) is disabled by security policy.")

        meta = validate_audio(audio_bytes)

        future = self._executor.submit(self.transcriber.transcribe, audio_bytes, language)
        result = future.result()

        payload_str = (
            f"voice:transcribe:model={result.model}:lang={result.language}:"
            f"duration_ms={result.duration_ms}:audio_duration_s={meta['duration_s']:.1f}:"
            f"size_bytes={meta['size_bytes']}:format={meta['format']}"
        )
        if hasattr(self.ctx, "audit"):
            self.ctx.audit.append(
                user=user,
                action="Voice transcription",
                component="Voice Input",
                risk="LOW",
                decision="ALLOW",
                classification="INTERNAL",
                payload=payload_str,
            )

        return result.to_dict()

    def speak(
        self,
        text: str,
        voice: str | None = None,
        speed: float = 1.0,
        user: str = "operator",
    ) -> bytes:
        """
        Sanitize and synthesize text to speech offline via local neural TTS.
        Applies secret redaction and markdown stripping before synthesis.
        Writes audit record with METADATA ONLY (character count, engine, voice, latency),
        never persisting the text or synthesized audio.
        """
        # 1. Policy gate check (POL-007)
        if not self.is_tts_policy_enabled():
            raise VoiceOutputDisabledError("Voice output policy (POL-007) is disabled by security policy.")

        # 2. Character limit check (max 2000 chars)
        if not text or not text.strip():
            raise VoiceError("Text to synthesize cannot be empty.")
        if len(text) > 2000:
            raise TextLengthExceededError("Text exceeds maximum synthesis length of 2000 characters.")

        # 3. Clean and redact secrets before synthesis
        clean = clean_text_for_speech(text, max_chars=2000)

        # 4. Offload neural synthesis to worker thread
        t0 = time.monotonic()
        future = self._executor.submit(self.synthesizer.synthesize, clean, voice, speed)
        wav_bytes = future.result()
        duration_ms = (time.monotonic() - t0) * 1000.0

        # 5. Record audit event with metadata ONLY - zero raw text or audio retention
        chosen_voice = voice or getattr(self.synthesizer, "default_voice", "default")
        engine_name = getattr(self.synthesizer, "name", "unknown")
        payload_str = (
            f"voice:speak:engine={engine_name}:voice={chosen_voice}:"
            f"char_count={len(clean)}:duration_ms={duration_ms:.0f}"
        )
        if hasattr(self.ctx, "audit"):
            self.ctx.audit.append(
                user=user,
                action="Voice synthesis",
                component="Voice Output",
                risk="LOW",
                decision="ALLOW",
                classification="INTERNAL",
                payload=payload_str,
            )

        return wav_bytes

    def shutdown(self):
        self._executor.shutdown(wait=False)
