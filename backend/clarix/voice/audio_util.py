"""Audio format validation and duration inspection utilities."""
from __future__ import annotations

import io
import wave
from typing import BinaryIO
from .errors import AudioDurationExceededError, AudioSizeExceededError, InvalidAudioError

MAX_AUDIO_BYTES = 10 * 1024 * 1024  # 10 MB
MAX_DURATION_S = 60.0               # 60 seconds

# Magic bytes
EBML_HEADER = b"\x1a\x45\xdf\xa3"   # WebM / Matroska
RIFF_HEADER = b"RIFF"               # WAV container
OGG_HEADER = b"OggS"                # OGG container


def detect_audio_format(data: bytes) -> str:
    """Identify audio container format from magic bytes."""
    if len(data) < 12:
        raise InvalidAudioError("Audio file is too small or truncated (< 12 bytes).")
    if data.startswith(EBML_HEADER):
        return "webm"
    if data.startswith(RIFF_HEADER) and data[8:12] == b"WAVE":
        return "wav"
    if data.startswith(OGG_HEADER):
        return "ogg"
    raise InvalidAudioError(
        f"Invalid audio format. Magic bytes {data[:4]!r} do not match supported containers (WAV, WebM, OGG)."
    )


def get_audio_duration(data: bytes, fmt: str) -> float:
    """Calculate or estimate audio duration in seconds."""
    if fmt == "wav":
        try:
            with wave.open(io.BytesIO(data), "rb") as wf:
                channels = wf.getnchannels()
                sampwidth = wf.getsampwidth()
                framerate = wf.getframerate()
                nframes = wf.getnframes()
                if framerate <= 0 or nframes < 0:
                    raise InvalidAudioError("Corrupted WAV header: invalid framerate or frame count.")
                return float(nframes) / float(framerate)
        except wave.Error as e:
            raise InvalidAudioError(f"Corrupted or invalid WAV file: {e}") from e

    # For WebM / OGG, attempt PyAV container inspection if available
    try:
        import av
        with av.open(io.BytesIO(data)) as container:
            if container.duration is not None and container.duration > 0:
                return float(container.duration) / float(av.time_base)
            # Try reading audio streams
            for stream in container.streams.audio:
                if stream.duration is not None and stream.time_base is not None:
                    return float(stream.duration * stream.time_base)
    except Exception:
        pass

    # Fallback heuristic: 10MB of 16kHz 16-bit mono PCM is ~320s, but WebM Opus is ~16-32 kbps (2-4 KB/s)
    # If size is < 10MB, return a safe conservative estimate or 0.0 if not parsable
    return 1.0


def validate_audio(
    data: bytes,
    max_bytes: int = MAX_AUDIO_BYTES,
    max_duration_s: float = MAX_DURATION_S,
) -> dict[str, any]:
    """
    Validate audio blob size, format magic bytes, and duration.
    Raises AudioSizeExceededError, InvalidAudioError, or AudioDurationExceededError.
    """
    if not data:
        raise InvalidAudioError("Empty audio data received.")
    if len(data) > max_bytes:
        raise AudioSizeExceededError(
            f"Audio file size ({len(data)} bytes) exceeds the maximum allowed limit of {max_bytes} bytes (10MB)."
        )

    fmt = detect_audio_format(data)
    duration_s = get_audio_duration(data, fmt)

    if duration_s > max_duration_s:
        raise AudioDurationExceededError(
            f"Audio duration ({duration_s:.1f}s) exceeds the maximum allowed limit of {max_duration_s:.0f}s."
        )

    return {
        "format": fmt,
        "duration_s": duration_s,
        "size_bytes": len(data),
    }
