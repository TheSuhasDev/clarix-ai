"""Tests for offline voice output (TTS / Piper speech synthesis).

Covers:
- Text cleaning: markdown, code blocks, URLs, citations removed
- Secret redaction before neural synthesis
- Character length limit (> 2000 chars rejected with 400)
- Missing voice model error with air-gap staging steps
- Mock synthesizer generating valid WAV audio in memory
- Audit event containing metadata only (zero text or audio retention)
- Policy toggle (POL-007)
- Service endpoint voice_speak (POST /api/voice/speak)
- Health status integration (/health and /api/health)
- Optional real Piper voice test (skipped if model files are absent)
"""
from __future__ import annotations

import io
import json
import unittest
import wave
from pathlib import Path

from clarix.errors import ApiError
from clarix.services import health_view, public_health, voice_speak
from clarix.voice import (
    MockSynthesizer,
    PiperSynthesizer,
    TextLengthExceededError,
    VoiceError,
    VoiceManager,
    VoiceNotFoundError,
    VoiceOutputDisabledError,
    clean_text_for_speech,
    redact_secrets,
    strip_markdown_and_citations,
)
from tests.helpers import Env


class DummyJsonRequest:
    def __init__(self, json_data: dict, operator: str = "operator"):
        self._json = json_data
        self.operator = operator

    def json(self) -> dict:
        return self._json


class TTSSanitizerTests(unittest.TestCase):
    def test_strip_markdown_formatting(self):
        raw = "# Critical Alert\nThis is **bold** text and *italic* text with ~~strikethrough~~.\n- Point 1\n• Point 2"
        cleaned = strip_markdown_and_citations(raw)
        self.assertNotIn("#", cleaned)
        self.assertNotIn("**", cleaned)
        self.assertNotIn("*", cleaned)
        self.assertNotIn("~~", cleaned)
        self.assertNotIn("•", cleaned)
        self.assertIn("Critical Alert", cleaned)
        self.assertIn("This is bold text and italic text with strikethrough", cleaned)

    def test_strip_code_blocks_and_inline_code(self):
        raw = "Run the following command:\n```bash\ncurl http://127.0.0.1:8000/api/health\n```\nOr use `npm run build`."
        cleaned = strip_markdown_and_citations(raw)
        self.assertNotIn("curl http", cleaned)
        self.assertNotIn("```", cleaned)
        self.assertNotIn("`", cleaned)
        self.assertIn("[Code block omitted]", cleaned)
        self.assertIn("npm run build", cleaned)

    def test_strip_urls_and_markdown_links(self):
        raw = "Refer to [Airgap Docs](http://docs.internal/airgap) or visit https://example.internal/test for updates."
        cleaned = strip_markdown_and_citations(raw)
        self.assertNotIn("http://docs.internal/airgap", cleaned)
        self.assertNotIn("https://example.internal/test", cleaned)
        self.assertIn("Airgap Docs", cleaned)

    def test_strip_citations(self):
        raw = "According to internal policy [1], egress is blocked [2] at layer 3 [42]."
        cleaned = strip_markdown_and_citations(raw)
        self.assertNotIn("[1]", cleaned)
        self.assertNotIn("[2]", cleaned)
        self.assertNotIn("[42]", cleaned)
        self.assertEqual(cleaned, "According to internal policy , egress is blocked at layer 3 .")

    def test_redact_secrets_in_text(self):
        raw = "User token: Bearer abc123def456ghi789 and api_key='sk-live-secret-key-12345678' with password: 'SuperSecret123'."
        redacted = redact_secrets(raw)
        self.assertNotIn("abc123def456ghi789", redacted)
        self.assertNotIn("sk-live-secret-key-12345678", redacted)
        self.assertNotIn("SuperSecret123", redacted)
        self.assertIn("[REDACTED]", redacted)

    def test_clean_text_unverified_and_blocked_notices(self):
        # Unverified notice
        t1 = clean_text_for_speech("Agent answer here.", is_unverified=True)
        self.assertTrue(t1.startswith("Warning: this answer could not be fully verified."))

        # Blocked notice
        t2 = clean_text_for_speech("Denied request.", is_blocked=True)
        self.assertTrue(t2.startswith("Request blocked by policy."))


class TTSSubsystemTests(Env):
    def setUp(self):
        super().setUp()
        self.mock_synthesizer = MockSynthesizer(default_voice="test-voice")
        self.ctx.voice = VoiceManager(self.ctx, synthesizer=self.mock_synthesizer)

    def test_mock_synthesize_produces_valid_wav(self):
        wav_bytes = self.ctx.voice.speak("System status is nominal.", user="operator")
        self.assertIsInstance(wav_bytes, bytes)
        self.assertGreater(len(wav_bytes), 44)  # Minimum RIFF header is 44 bytes

        # Validate with standard wave module
        with wave.open(io.BytesIO(wav_bytes), "rb") as wf:
            self.assertEqual(wf.getnchannels(), 1)
            self.assertEqual(wf.getsampwidth(), 2)
            self.assertEqual(wf.getframerate(), 16000)
            self.assertGreater(wf.getnframes(), 0)

    def test_text_length_limit(self):
        long_text = "a" * 2001
        with self.assertRaises(TextLengthExceededError):
            self.ctx.voice.speak(long_text)

        # Service level returns 400
        req = DummyJsonRequest({"text": long_text})
        with self.assertRaises(ApiError) as cm:
            voice_speak(self.ctx, req)
        self.assertEqual(cm.exception.status, 400)

    def test_missing_voice_returns_staging_steps(self):
        empty_dir = self.ctx.settings.data_dir / "empty_piper"
        empty_dir.mkdir(parents=True, exist_ok=True)
        piper = PiperSynthesizer(voice_dir=empty_dir, default_voice="missing-voice")
        manager = VoiceManager(self.ctx, synthesizer=piper)

        with self.assertRaises(VoiceNotFoundError) as cm:
            manager.speak("Hello world")

        err = cm.exception
        self.assertEqual(err.voice_name, "missing-voice")
        self.assertTrue(len(err.staging_steps) >= 3)
        self.assertIn("curl", err.staging_steps[0] + err.staging_steps[1])

    def test_audit_event_contains_metadata_only_zero_text(self):
        secret_prompt = "The nuclear launch code is secret-alpha-bravo-778899"
        self.ctx.voice.speak(secret_prompt, user="auditor")

        # Query audit log
        events = self.ctx.audit.list(limit=10)
        tts_events = [e for e in events if e["component"] == "Voice Output"]
        self.assertEqual(len(tts_events), 1)
        row = tts_events[0]
        self.assertEqual(row["user"], "auditor")
        self.assertEqual(row["action"], "Voice synthesis")
        self.assertEqual(row["decision"], "ALLOW")

        payload = row["payload"]
        self.assertIn("voice:speak:engine=mock", payload)
        self.assertIn("char_count=", payload)
        self.assertIn("duration_ms=", payload)

        # Ensure NO raw text or secret words leaked into audit payload
        self.assertNotIn("nuclear", payload)
        self.assertNotIn("launch", payload)
        self.assertNotIn("secret-alpha-bravo-778899", payload)

    def test_policy_toggle_pol007(self):
        # POL-007 is enabled by default
        self.assertTrue(self.ctx.voice.is_tts_policy_enabled())
        wav = self.ctx.voice.speak("Testing policy allow.")
        self.assertGreater(len(wav), 0)

        # Disable POL-007
        self.ctx.policy.set_enabled("POL-007", False)
        self.assertFalse(self.ctx.voice.is_tts_policy_enabled())

        # Calling speak directly raises VoiceOutputDisabledError
        with self.assertRaises(VoiceOutputDisabledError):
            self.ctx.voice.speak("Should fail when disabled.")

        # Calling voice_speak API raises 403 Forbidden
        req = DummyJsonRequest({"text": "Should fail with 403"})
        with self.assertRaises(ApiError) as cm:
            voice_speak(self.ctx, req)
        self.assertEqual(cm.exception.status, 403)

        # Re-enable POL-007
        self.ctx.policy.set_enabled("POL-007", True)
        self.assertTrue(self.ctx.voice.is_tts_policy_enabled())
        wav2 = self.ctx.voice.speak("Should succeed now.")
        self.assertGreater(len(wav2), 0)

    def test_voice_speak_api_endpoint(self):
        req = DummyJsonRequest({"text": "System ready.", "speed": 1.25})
        status, body, headers = voice_speak(self.ctx, req)
        self.assertEqual(status, 200)
        self.assertIsInstance(body, bytes)
        self.assertEqual(headers["Content-Type"], "audio/wav")
        self.assertEqual(headers["Content-Length"], str(len(body)))

    def test_health_endpoints_include_tts(self):
        # Public health
        pub = public_health(self.ctx, DummyJsonRequest({}))
        self.assertIn("tts", pub)
        self.assertEqual(pub["tts"]["engine"], "mock")
        self.assertTrue(pub["tts"]["ready"])
        self.assertTrue(pub["tts"]["policyEnabled"])

        # Health view
        hv = health_view(self.ctx, DummyJsonRequest({}))
        self.assertIn("tts", hv)
        self.assertEqual(hv["tts"]["engine"], "mock")
        self.assertTrue(hv["tts"]["ready"])


class RealPiperVoiceTest(unittest.TestCase):
    """Optional test against real Piper ONNX voice file if staged in models/piper/."""

    def test_real_piper_synthesis_if_present(self):
        voice_dir = Path("./models/piper") if Path("./models/piper").is_dir() else Path("../models/piper")
        voice_name = "en_US-lessac-low"
        onnx_file = voice_dir / f"{voice_name}.onnx"
        json_file = voice_dir / f"{voice_name}.onnx.json"

        if not onnx_file.is_file() or not json_file.is_file():
            self.skipTest(f"Piper model {voice_name} not staged in {voice_dir}. Skipping real ONNX test.")

        synth = PiperSynthesizer(voice_dir=voice_dir, default_voice=voice_name)
        self.assertTrue(synth.is_ready())
        self.assertIn(voice_name, synth.list_voices())

        wav_bytes = synth.synthesize("Security monitoring active. All nodes reporting nominal.", speed=1.0)
        self.assertIsInstance(wav_bytes, bytes)
        self.assertGreater(len(wav_bytes), 1000)

        # Check wave validity
        with wave.open(io.BytesIO(wav_bytes), "rb") as wf:
            self.assertEqual(wf.getnchannels(), 1)
            self.assertEqual(wf.getframerate(), 16000)
            self.assertGreater(wf.getnframes(), 5000)
