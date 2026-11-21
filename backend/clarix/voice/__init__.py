"""Voice subsystem exports."""
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
from .manager import VoiceManager
from .synthesizer import BaseSynthesizer, MockSynthesizer, PiperSynthesizer
from .transcriber import BaseTranscriber, FasterWhisperTranscriber, MockTranscriber, TranscriptionResult
from .tts_sanitizer import clean_text_for_speech, redact_secrets, strip_markdown_and_citations

__all__ = [
    "VoiceError",
    "ModelNotFoundError",
    "VoiceNotFoundError",
    "InvalidAudioError",
    "AudioDurationExceededError",
    "AudioSizeExceededError",
    "TextLengthExceededError",
    "VoiceDisabledError",
    "VoiceOutputDisabledError",
    "VoiceManager",
    "BaseTranscriber",
    "FasterWhisperTranscriber",
    "MockTranscriber",
    "TranscriptionResult",
    "BaseSynthesizer",
    "PiperSynthesizer",
    "MockSynthesizer",
    "clean_text_for_speech",
    "redact_secrets",
    "strip_markdown_and_citations",
]
