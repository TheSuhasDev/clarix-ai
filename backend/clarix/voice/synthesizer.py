"""Offline speech synthesizer implementations: Piper neural TTS, Mock, and SAPI fallback."""
from __future__ import annotations

import io
import logging
import math
import struct
import threading
import wave
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any

from .errors import VoiceNotFoundError

log = logging.getLogger("clarix.voice.tts")


class BaseSynthesizer(ABC):
    """Abstract base class for offline speech synthesis."""

    name: str = "base"
    default_voice: str = "default"

    @abstractmethod
    def synthesize(self, text: str, voice: str | None = None, speed: float = 1.0) -> bytes:
        """Synthesize text to WAV audio bytes completely in-memory."""
        pass

    @abstractmethod
    def is_ready(self) -> bool:
        """Check whether the engine and default voice are loaded or available."""
        pass

    @abstractmethod
    def get_status(self) -> dict[str, Any]:
        """Subsystem metadata for health and UI telemetry."""
        pass


class PiperSynthesizer(BaseSynthesizer):
    """
    Offline neural TTS using local Piper models (ONNX + JSON).
    Strictly air-gapped: loads models solely from local disk, never downloads at runtime.
    Synthesizes directly into in-memory audio/wav bytes (zero disk storage).
    """

    name: str = "piper"

    def __init__(self, voice_dir: Path | str, default_voice: str = "en_US-lessac-low"):
        self.voice_dir = Path(voice_dir)
        self.default_voice = default_voice
        self._voice_cache: dict[str, Any] = {}
        self._lock = threading.Lock()

    def _resolve_paths(self, voice_name: str) -> tuple[Path, Path]:
        """Locate .onnx and .onnx.json files for a voice."""
        base_name = voice_name
        if base_name.endswith(".onnx"):
            base_name = base_name[:-5]

        onnx_file = self.voice_dir / f"{base_name}.onnx"
        json_file = self.voice_dir / f"{base_name}.onnx.json"

        # Also check direct file if user passed full name
        if not onnx_file.is_file() and (self.voice_dir / voice_name).is_file():
            onnx_file = self.voice_dir / voice_name
            json_file = self.voice_dir / f"{voice_name}.json"

        return onnx_file, json_file

    def list_voices(self) -> list[str]:
        """List all valid staged voices in the voice directory."""
        if not self.voice_dir.is_dir():
            return []
        voices = []
        for p in self.voice_dir.glob("*.onnx"):
            cfg = p.with_name(f"{p.name}.json")
            if not cfg.is_file():
                cfg = p.with_suffix(".onnx.json")
            if cfg.is_file() or p.with_name(f"{p.stem}.json").is_file():
                voices.append(p.stem)
        return sorted(voices)

    def is_ready(self) -> bool:
        """Ready if the default voice files exist on local disk."""
        onnx_file, json_file = self._resolve_paths(self.default_voice)
        return onnx_file.is_file() and json_file.is_file()

    def _get_or_load_voice(self, voice_name: str):
        """Lazy-load Piper voice instance safely with lock."""
        with self._lock:
            if voice_name in self._voice_cache:
                return self._voice_cache[voice_name]

            onnx_file, json_file = self._resolve_paths(voice_name)
            if not onnx_file.is_file() or not json_file.is_file():
                raise VoiceNotFoundError(voice_name, self.voice_dir)

            try:
                from piper import PiperVoice
                log.info("Loading offline Piper voice '%s' from %s", voice_name, onnx_file)
                voice_inst = PiperVoice.load(str(onnx_file), config_path=str(json_file))
                self._voice_cache[voice_name] = voice_inst
                return voice_inst
            except ImportError as e:
                log.error("piper-tts is not installed: %s", e)
                raise RuntimeError(
                    "piper-tts library is not available in Python environment. Run 'pip install piper-tts'."
                ) from e

    def synthesize(self, text: str, voice: str | None = None, speed: float = 1.0) -> bytes:
        """
        Synthesizes text into a complete, in-memory RIFF/WAVE stream.
        No audio files are written to disk.
        """
        voice_name = voice or self.default_voice
        voice_inst = self._get_or_load_voice(voice_name)

        # Piper supports length_scale via SynthesisConfig: higher values slow down speech, lower values speed it up
        syn_config = None
        if abs(speed - 1.0) > 0.01:
            try:
                from piper.config import SynthesisConfig
                speed_clamped = max(0.5, min(2.0, speed))
                syn_config = SynthesisConfig(length_scale=1.0 / speed_clamped)
            except Exception:
                syn_config = None

        # Synthesize audio chunks via Piper
        if syn_config is not None:
            chunks = list(voice_inst.synthesize(text, syn_config=syn_config))
        else:
            chunks = list(voice_inst.synthesize(text))
        if not chunks:
            # Generate empty WAV header if no chunks
            buf = io.BytesIO()
            with wave.open(buf, "wb") as wav_file:
                wav_file.setnchannels(1)
                wav_file.setsampwidth(2)
                wav_file.setframerate(16000)
            return buf.getvalue()

        # Combine all audio chunks into memory buffer
        first = chunks[0]
        n_channels = getattr(first, "sample_channels", 1)
        sampwidth = getattr(first, "sample_width", 2)
        framerate = getattr(first, "sample_rate", 16000)

        buf = io.BytesIO()
        with wave.open(buf, "wb") as wav_file:
            wav_file.setnchannels(n_channels)
            wav_file.setsampwidth(sampwidth)
            wav_file.setframerate(framerate)
            for c in chunks:
                wav_file.writeframes(c.audio_int16_bytes)

        return buf.getvalue()

    def get_status(self) -> dict[str, Any]:
        """Subsystem metadata."""
        voices = self.list_voices()
        ready = self.is_ready()
        return {
            "engine": "piper",
            "ready": ready,
            "voice": self.default_voice,
            "voiceLoaded": self.default_voice in self._voice_cache,
            "voiceDir": str(self.voice_dir),
            "availableVoices": voices,
        }


class MockSynthesizer(BaseSynthesizer):
    """
    Deterministic mock synthesizer for unit testing and CI without ONNX model files.
    Generates a valid, compact 16kHz PCM WAV in memory.
    """

    name: str = "mock"

    def __init__(self, default_voice: str = "mock-en-voice"):
        self.default_voice = default_voice
        self.call_history: list[dict[str, Any]] = []

    def synthesize(self, text: str, voice: str | None = None, speed: float = 1.0) -> bytes:
        self.call_history.append({"text": text, "voice": voice or self.default_voice, "speed": speed})

        sample_rate = 16000
        # Generate 0.15s of a soft sine tone (440 Hz)
        num_samples = int(sample_rate * 0.15)
        buf = io.BytesIO()
        with wave.open(buf, "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(sample_rate)
            raw = bytearray()
            for i in range(num_samples):
                val = int(3000 * math.sin(2 * math.pi * 440 * i / sample_rate))
                raw.extend(struct.pack("<h", val))
            w.writeframes(raw)
        return buf.getvalue()

    def is_ready(self) -> bool:
        return True

    def get_status(self) -> dict[str, Any]:
        return {
            "engine": "mock",
            "ready": True,
            "voice": self.default_voice,
            "voiceLoaded": True,
            "voiceDir": "mock://internal",
            "availableVoices": [self.default_voice, "mock-second-voice"],
        }
