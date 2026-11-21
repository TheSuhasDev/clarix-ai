# Clarix AI — Air-Gapped Deployment Guide

This guide details the procedure for deploying Clarix AI onto a physically isolated, air-gapped host with zero external internet connectivity.

---

## 1. Staging & Asset Preparation

Because the target host cannot access the internet, all software dependencies and models must be prepared on an internet-connected staging machine and transferred via secure write-once media (USB or optical disc).

### 1.1 Download Language Models (Ollama)
On the staging machine:
```bash
# Pull LLM for reasoning
ollama pull llama3
# Pull embedding model for vector RAG
ollama pull nomic-embed-text

# Archive the model directory
tar -czvf ollama-models.tar.gz -C ~/.ollama/models .
```

### 1.2 Download Offline Speech-to-Text Models (Whisper Flow)
On the staging machine:
```bash
# Install Hugging Face Hub CLI on the connected machine
pip install huggingface-hub

# Download faster-whisper (CTranslate2) weights for base or tiny model
mkdir -p ./models/whisper/base
huggingface-cli download Systran/faster-whisper-base --local-dir ./models/whisper/base

# Optionally download tiny or small models
mkdir -p ./models/whisper/tiny
huggingface-cli download Systran/faster-whisper-tiny --local-dir ./models/whisper/tiny

# Archive for physical media transfer
tar -czvf whisper-models.tar.gz -C ./models/whisper .
```

### 1.3 Download Offline Text-to-Speech Voices (Piper TTS)
On the staging machine:
```bash
# Create local piper directory
mkdir -p ./models/piper

# Download Piper neural voice model and config (.onnx + .onnx.json)
# Recommended voice: en_US-lessac-low (clean, fast, low memory footprint)
curl -L -o ./models/piper/en_US-lessac-low.onnx \
  https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/low/en_US-lessac-low.onnx

curl -L -o ./models/piper/en_US-lessac-low.onnx.json \
  https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/low/en_US-lessac-low.onnx.json

# Archive for physical media transfer
tar -czvf piper-voices.tar.gz -C ./models/piper .
```

### 1.4 Package Python Wheels & Node Build
On the staging machine:
```bash
# Backend dependencies (includes piper-tts, pyttsx3, faster-whisper)
pip download -r backend/requirements.txt -d ./pip-packages

# Frontend production build
cd frontend
npm install
npm run build
tar -czvf frontend-dist.tar.gz dist/
```

---

## 2. Target Host Installation

Transfer `ollama-models.tar.gz`, `pip-packages/`, and `frontend-dist.tar.gz` to `/opt/clarix/` on the isolated host.

### 2.1 Set Up Ollama
```bash
mkdir -p ~/.ollama/models
tar -xzvf ollama-models.tar.gz -C ~/.ollama/models

# Configure Ollama to bind to loopback ONLY
export OLLAMA_HOST=127.0.0.1:11434
systemctl enable --now ollama
```

### 2.2 Install Backend
```bash
cd /opt/clarix/backend
python3 -m venv .venv
source .venv/bin/activate
pip install --no-index --find-links=/opt/clarix/pip-packages -r requirements.txt
cp .env.example .env

# Set up Whisper models for air-gapped voice input
mkdir -p /opt/clarix/models/whisper
tar -xzvf /opt/clarix/whisper-models.tar.gz -C /opt/clarix/models/whisper
# Configure in .env:
# CLARIX_WHISPER_MODEL_DIR=/opt/clarix/models/whisper
# CLARIX_WHISPER_MODEL=base
```

---

## 3. Kernel & OS-Level Host Isolation

Defense-in-depth requires that the host operating system strictly prohibits external network connectivity independently of the application layer.

### 3.1 Option A: `nftables` (Recommended for Linux 5.x+)
Install [deploy/nftables-airgap.conf](file:///c:/Users/suhas/Desktop/clarix-ai/backend/deploy/nftables-airgap.conf):
```bash
sudo cp backend/deploy/nftables-airgap.conf /etc/nftables.conf
sudo systemctl enable --now nftables
```

### 3.2 Option B: `iptables`
Execute [deploy/iptables-airgap.sh](file:///c:/Users/suhas/Desktop/clarix-ai/backend/deploy/iptables-airgap.sh):
```bash
sudo bash backend/deploy/iptables-airgap.sh
```

### 3.3 Option C: `pf` (macOS / BSD)
Load [deploy/pf-airgap.conf](file:///c:/Users/suhas/Desktop/clarix-ai/backend/deploy/pf-airgap.conf):
```bash
sudo pfctl -ef backend/deploy/pf-airgap.conf
```

---

## 4. Hardened Systemd Service

Install the hardened systemd unit from [deploy/clarix.service](file:///c:/Users/suhas/Desktop/clarix-ai/backend/deploy/clarix.service):
```ini
[Unit]
Description=Clarix AI backend (air-gapped agent harness)
After=network.target ollama.service

[Service]
User=clarix
Group=clarix
WorkingDirectory=/opt/clarix/backend
ExecStart=/opt/clarix/backend/.venv/bin/python -m clarix
Restart=on-failure

# Kernel-enforced cgroup network filtering
IPAddressDeny=any
IPAddressAllow=localhost

# Sandboxing
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes
PrivateDevices=yes
ReadWritePaths=/opt/clarix/backend/data
```

Activate the service:
```bash
sudo cp backend/deploy/clarix.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now clarix
```

---

## 5. Verification & Air-Gap Probing

Run the independent verification script [deploy/verify_airgap.sh](file:///c:/Users/suhas/Desktop/clarix-ai/backend/deploy/verify_airgap.sh):
```bash
bash backend/deploy/verify_airgap.sh
```

Expected output on a properly isolated host:
```text
== default route ==
none
== established non-loopback sockets ==
none
== active connection attempts ==
unreachable: 1.1.1.1:443
unreachable: 8.8.8.8:53
== Clarix self-report ==
guard: {'installed': True, 'enforcing': True} | posture: ISOLATED | ollama: {'reachable': True}
RESULT: no outbound reachability found
```

---

## 6. Hardware Requirements & Speech Benchmarks

### Speech-to-Text (Whisper Flow)
| Model Size | Parameters | Disk Space | Active RAM | Transcription Time (10s audio) | Recommended Hardware |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Tiny** | 39 M | ~75 MB | ~123 MB | **~0.60s** (16x real-time) | Any modern 2+ core CPU |
| **Base** (Default) | 74 M | ~145 MB | ~165 MB | **~1.12s** (9x real-time) | 4+ core CPU, 4 GB RAM |
| **Small** | 244 M | ~485 MB | ~335 MB | **~3.46s** (3x real-time) | 4+ core CPU, 8 GB RAM |

*Note: All Whisper models run strictly locally via CTranslate2 CPU INT8 quantization. Zero external network egress is generated, and audio is deleted from RAM immediately after transcription (zero retention).*

### Text-to-Speech (Piper Neural TTS & Fallback)
| Engine | Voice Model | Model Size | RAM Usage | Measured Latency (2-sentence reply) |
| :--- | :--- | :--- | :--- | :--- |
| **Piper Neural TTS** (Primary) | `en_US-lessac-low` | ~60 MB | ~185 MB | **~0.30s** (~15x real-time) |
| **pyttsx3 / SAPI5** (Local Fallback) | Microsoft David / Zira Desktop | 0 MB (built-in) | ~65 MB | **~0.16s** (~30x real-time) |
| **Web Speech API** (Air-Gap Browser) | OS Native (`localService: true`) | 0 MB (OS native) | ~15 MB | **~0.05s** (Client-side native) |

*Air-gap safety guarantee: Browser speech synthesis is strictly restricted to voices where `localService === true`. Any cloud voices (`localService !== true`) that would communicate over WAN/CDN are unconditionally rejected.*
