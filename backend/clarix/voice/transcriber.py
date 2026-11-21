"""Whisper speech-to-text transcriber implementation.

Strictly offline and air-gapped:
- Loads models from local directory (never downloads at runtime).
- Uses faster-whisper (CTranslate2) with lazy-loading and thread-safe lock.
- Supports language auto-detection and language override.
- Zero audio retention: audio bytes are discarded immediately after transcription.
"""
from __future__ import annotations

import io
import logging
import os
import tempfile
import threading
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .audio_util import detect_audio_format
from .errors import ModelNotFoundError, VoiceError

log = logging.getLogger("clarix.voice")


@dataclass
class TranscriptionResult:
    text: str
    language: str
    duration_ms: int
    model: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "text": self.text,
            "language": self.language,
            "durationMs": self.duration_ms,
            "model": self.model,
        }


class BaseTranscriber(ABC):
    """Abstract interface for speech transcription engines."""

    @abstractmethod
    def is_ready(self) -> bool:
        """Return True if model files are found locally and ready to be loaded."""
        ...

    @abstractmethod
    def is_loaded(self) -> bool:
        """Return True if the model weights are currently loaded in RAM."""
        ...

    @abstractmethod
    def get_status(self) -> dict[str, Any]:
        """Return readiness and model metadata."""
        ...

    @abstractmethod
    def transcribe(self, audio_bytes: bytes, language: str | None = None) -> TranscriptionResult:
        """Transcribe speech audio bytes to text."""
        ...


class FasterWhisperTranscriber(BaseTranscriber):
    """faster-whisper (CTranslate2) implementation operating strictly from local files."""

    def __init__(
        self,
        model_dir: Path | str,
        model_name: str = "base",
        default_language: str | None = None,
        device: str = "cpu",
        compute_type: str = "int8",
    ):
        self.model_dir = Path(model_dir)
        self.model_name = model_name
        self.default_language = default_language
        self.device = device
        self.compute_type = compute_type
        self._model = None
        self._lock = threading.Lock()

    def resolve_model_path(self) -> Path | None:
        """Locate directory containing model.bin / model.safetensors and config.json."""
        candidates = [
            self.model_dir,
            self.model_dir / self.model_name,
            self.model_dir / f"faster-whisper-{self.model_name}",
        ]
        for c in candidates:
            if c.is_dir():
                has_weights = (c / "model.bin").is_file() or (c / "model.safetensors").is_file()
                has_config = (c / "config.json").is_file()
                if has_weights and has_config:
                    return c
        return None

    def is_ready(self) -> bool:
        return self.resolve_model_path() is not None

    def is_loaded(self) -> bool:
        return self._model is not None

    def get_status(self) -> dict[str, Any]:
        path = self.resolve_model_path()
        return {
            "ready": path is not None,
            "loaded": self.is_loaded(),
            "model": self.model_name,
            "modelDir": str(self.model_dir),
            "resolvedPath": str(path) if path else None,
            "device": self.device,
            "computeType": self.compute_type,
            "defaultLanguage": self.default_language,
        }

    def _ensure_model(self):
        """Lazy-load the Whisper model under a lock. Never downloads from external sources."""
        if self._model is not None:
            return self._model

        with self._lock:
            if self._model is not None:
                return self._model

            model_path = self.resolve_model_path()
            if not model_path:
                raise ModelNotFoundError(self.model_name, self.model_dir)

            try:
                from faster_whisper import WhisperModel
                log.info("Loading offline Whisper model from %s (device=%s, compute=%s)...", model_path, self.device, self.compute_type)
                # local_files_only=True guarantees zero outbound network calls
                self._model = WhisperModel(
                    str(model_path),
                    device=self.device,
                    compute_type=self.compute_type,
                    local_files_only=True,
                )
                log.info("Offline Whisper model loaded successfully.")
                return self._model
            except ImportError as e:
                raise VoiceError(f"faster-whisper is not installed in the python environment: {e}") from e
            except Exception as e:
                raise VoiceError(f"Failed to load local Whisper model from {model_path}: {e}") from e

    def transcribe(self, audio_bytes: bytes, language: str | None = None) -> TranscriptionResult:
        model = self._ensure_model()
        t0 = time.time()
        fmt = detect_audio_format(audio_bytes)

        target_lang = language or self.default_language
        temp_file = None

        try:
            # We attempt direct memory stream first
            try:
                stream = io.BytesIO(audio_bytes)
                segments, info = model.transcribe(
                    stream,
                    language=target_lang,
                    beam_size=1,
                    word_timestamps=False,
                    vad_filter=True,
                )
                text = " ".join(s.text.strip() for s in segments).strip()
                detected_lang = info.language if info else (target_lang or "en")
            except Exception as e_mem:
                log.debug("In-memory transcription fallback to temp file: %s", e_mem)
                # Fallback to temp file for formats that require file-descriptor seeking
                ext = f".{fmt}"
                with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tf:
                    tf.write(audio_bytes)
                    temp_file = tf.name

                segments, info = model.transcribe(
                    temp_file,
                    language=target_lang,
                    beam_size=1,
                    word_timestamps=False,
                    vad_filter=True,
                )
                text = " ".join(s.text.strip() for s in segments).strip()
                detected_lang = info.language if info else (target_lang or "en")

            duration_ms = int((time.time() - t0) * 1000)
            return TranscriptionResult(
                text=text,
                language=detected_lang,
                duration_ms=duration_ms,
                model=self.model_name,
            )
        finally:
            # Zero audio retention: strictly delete any temporary audio file immediately
            if temp_file and os.path.exists(temp_file):
                try:
                    os.unlink(temp_file)
                except Exception as e_del:
                    log.warning("Failed to remove temp audio file %s: %s", temp_file, e_del)


class MockTranscriber(BaseTranscriber):
    """Deterministic mock transcriber for CI, unit testing, and offline test runs."""

    def __init__(
        self,
        model_name: str = "mock-whisper",
        mock_text: str = "This is a transcribed voice message.",
        mock_language: str = "en",
        is_ready_val: bool = True,
        simulate_error: Exception | None = None,
    ):
        self.model_name = model_name
        self.mock_text = mock_text
        self.mock_language = mock_language
        self._is_ready = is_ready_val
        self.simulate_error = simulate_error
        self._loaded = True

    def is_ready(self) -> bool:
        return self._is_ready

    def is_loaded(self) -> bool:
        return self._loaded

    def get_status(self) -> dict[str, Any]:
        return {
            "ready": self._is_ready,
            "loaded": self._loaded,
            "model": self.model_name,
            "modelDir": "mock://models/whisper",
            "resolvedPath": "mock://models/whisper/base" if self._is_ready else None,
            "device": "cpu",
            "computeType": "mock",
            "defaultLanguage": self.mock_language,
        }

    def transcribe(self, audio_bytes: bytes, language: str | None = None) -> TranscriptionResult:
        if self.simulate_error:
            raise self.simulate_error
        if not self._is_ready:
            raise ModelNotFoundError(self.model_name, "mock://models/whisper")

        # Basic multi-language simulation for testing
        lang = language or self.mock_language
        text = self.mock_text
        if lang == "hi":
            text = "नमस्ते, यह एक गोपनीय दस्तावेज़ की खोज है।"
        elif lang == "kn":
            text = "ನಮಸ್ಕಾರ, ಇದು ಗೌಪ್ಯ ದಾಖಲೆಯ ಹುಡುಕಾಟವಾಗಿದೆ."

        return TranscriptionResult(
            text=text,
            language=lang,
            duration_ms=45,
            model=self.model_name,
        )
