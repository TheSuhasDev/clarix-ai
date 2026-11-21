"""Voice subsystem errors and exceptions."""
from __future__ import annotations
from pathlib import Path


class VoiceError(Exception):
    """Base class for voice subsystem errors."""
    pass


class ModelNotFoundError(VoiceError):
    """Raised when the Whisper model directory does not contain required model files."""
    def __init__(self, model_name: str, model_dir: Path | str):
        self.model_name = model_name
        self.model_dir = Path(model_dir)
        self.staging_steps = [
            f"1. On an internet-connected workstation, install huggingface-hub: pip install huggingface-hub",
            f"2. Download the CTranslate2 model: huggingface-cli download Systran/faster-whisper-{model_name} --local-dir {self.model_dir.as_posix()}",
            f"3. Transfer the directory via verified USB storage / staging media to the air-gapped host: {self.model_dir}",
            f"4. Verify that {self.model_dir / 'model.bin'} (or model.safetensors) and {self.model_dir / 'config.json'} exist."
        ]
        super().__init__(
            f"Whisper offline model '{model_name}' not found in '{self.model_dir}'. "
            f"Air-gap staging required: download model on an external machine and place files in '{self.model_dir}'."
        )

    def to_dict(self) -> dict:
        return {
            "error": "model_not_found",
            "message": str(self),
            "model": self.model_name,
            "modelDir": str(self.model_dir),
            "stagingSteps": self.staging_steps,
        }


class VoiceNotFoundError(VoiceError):
    """Raised when Piper voice model files (.onnx, .onnx.json) are not found locally."""
    def __init__(self, voice_name: str, voice_dir: Path | str):
        self.voice_name = voice_name
        self.voice_dir = Path(voice_dir)
        self.staging_steps = [
            f"1. On an internet-connected workstation, download the Piper voice model and config:",
            f"   curl -L -o {self.voice_name}.onnx https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/low/{self.voice_name}.onnx",
            f"   curl -L -o {self.voice_name}.onnx.json https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/low/{self.voice_name}.onnx.json",
            f"2. Copy the downloaded files to verified USB storage / staging media.",
            f"3. Transfer to the air-gapped host directory: {self.voice_dir}",
            f"4. Confirm that '{self.voice_name}.onnx' and '{self.voice_name}.onnx.json' are present in '{self.voice_dir}'."
        ]
        super().__init__(
            f"Piper offline voice '{voice_name}' not found in '{self.voice_dir}'. "
            f"Air-gap staging required: download voice files (.onnx and .onnx.json) on an external machine and place in '{self.voice_dir}'."
        )

    def to_dict(self) -> dict:
        return {
            "error": "voice_not_found",
            "message": str(self),
            "voice": self.voice_name,
            "voiceDir": str(self.voice_dir),
            "stagingSteps": self.staging_steps,
        }


class InvalidAudioError(VoiceError):
    """Raised when audio data fails validation (magic bytes, format)."""
    pass


class AudioDurationExceededError(VoiceError):
    """Raised when audio exceeds the maximum permitted duration (60s)."""
    pass


class AudioSizeExceededError(VoiceError):
    """Raised when audio exceeds the maximum size limit (10MB)."""
    pass


class TextLengthExceededError(VoiceError):
    """Raised when synthesis text exceeds maximum character limit (2000 chars)."""
    pass


class VoiceDisabledError(VoiceError):
    """Raised when voice input policy (POL-006) is disabled."""
    pass


class VoiceOutputDisabledError(VoiceError):
    """Raised when voice output policy (POL-007) is disabled."""
    pass
