/* ============================================
   PBG Business Board — WebRTC Voice Chat Manager
   Enhanced with fallback tiers and diagnostic guide
   ============================================ */

class VoiceChatManager {
  constructor() {
    this.localStream = null;
    this.isMuted = true;
    this.isVirtual = false;
    this.isSupported = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    this.audioContext = null;
    this.analyser = null;
    this.speakingInterval = null;
    this.isSpeaking = false;
  }

  async toggleMic() {
    if (!this.isSupported) {
      showToast('Voice chat is not supported on this browser/device.', 'warning');
      return false;
    }

    if (!this.localStream && !this.isVirtual) {
      // Tier 1: Try with enhanced constraints
      let stream = null;
      let lastError = null;

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          },
          video: false
        });
      } catch (err1) {
        lastError = err1;
        // Tier 2: Fallback to basic audio
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          lastError = null;
        } catch (err2) {
          lastError = err2;
        }
      }

      if (stream) {
        this.localStream = stream;
        this.isVirtual = false;
        this.isMuted = false;
        this.setupAudioAnalysis();
        this.updateMicTrackState();
        this.connectPeers();
        showToast('🎙️ Microphone connected! You are now live in voice chat.', 'success');
        return true;
      } else {
        console.warn('Microphone error details:', lastError);
        this.handleMicrophoneError(lastError);
        return false;
      }
    } else if (this.isVirtual) {
      // Toggle virtual mic
      this.isMuted = !this.isMuted;
      this.isSpeaking = !this.isMuted;
      this.updateSpeakingVisual(game?.myPlayerId, this.isSpeaking);
      if (mpClient && mpClient.connected) {
        mpClient.sendVoiceStatus(this.isSpeaking, this.isMuted);
      }
      showToast(this.isMuted ? '🔇 Virtual Mic muted.' : '🎙️ Virtual Mic active (Speaking).', 'info');
      return !this.isMuted;
    } else {
      this.isMuted = !this.isMuted;
      this.updateMicTrackState();
      showToast(this.isMuted ? '🔇 Microphone muted.' : '🎙️ Microphone unmuted (Live).', 'info');
      return !this.isMuted;
    }
  }

  handleMicrophoneError(err) {
    const errorName = err?.name || 'Error';
    let title = 'Microphone Permission & Access';
    let detailMsg = '';

    if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
      detailMsg = `
        <p style="margin-bottom:10px; color:#334155;">Browser or OS privacy settings prevented microphone access.</p>
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px; font-size:0.8rem; text-align:left; line-height:1.5; margin-bottom:12px;">
          <strong>Quick Fix Steps:</strong>
          <ol style="margin-left:18px; margin-top:4px;">
            <li>Click the 🔒 <strong>Tune / Padlock icon</strong> next to <code>localhost:3000</code> in your browser address bar.</li>
            <li>Make sure <strong>Microphone</strong> is set to <strong>Allow</strong>.</li>
            <li>On Windows: Check <strong>Windows Settings &gt; Privacy &gt; Microphone</strong> to ensure access is turned ON.</li>
          </ol>
        </div>
      `;
    } else if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
      detailMsg = `
        <p style="margin-bottom:10px; color:#334155;">No physical microphone hardware was detected on your system.</p>
      `;
    } else if (errorName === 'NotReadableError' || errorName === 'TrackStartError') {
      detailMsg = `
        <p style="margin-bottom:10px; color:#334155;">Your microphone is currently in use by another application (Zoom, Teams, Discord, etc.).</p>
      `;
    } else {
      detailMsg = `
        <p style="margin-bottom:10px; color:#334155;">Unable to access audio input: <code>${err?.message || errorName}</code></p>
      `;
    }

    showModal(`
      <div class="title-deed-card" style="max-width:380px;">
        <div class="deed-header" style="--deed-color: #f59e0b;">
          <div class="deed-header-sub">VOICE CHAT SETUP</div>
          <div class="deed-header-title">${title}</div>
        </div>
        <div class="deed-body">
          ${detailMsg}
          <div class="deed-actions" style="flex-direction:column; gap:8px;">
            <button class="btn btn-primary btn-small" onclick="voiceManager.enableVirtualMic()">
              🎙️ Enable Virtual Mic Mode (Simulation)
            </button>
            <button class="btn btn-secondary btn-small" onclick="hideModal()">
              Dismiss
            </button>
          </div>
        </div>
      </div>
    `);
  }

  enableVirtualMic() {
    hideModal();
    this.isVirtual = true;
    this.isMuted = false;
    this.isSpeaking = true;
    this.updateSpeakingVisual(game?.myPlayerId, true);

    const voiceBtn = document.getElementById('btn-ingame-voice');
    if (voiceBtn) {
      voiceBtn.classList.add('active');
      voiceBtn.innerHTML = `<i class="fas fa-microphone"></i> <span>Voice ON</span>`;
    }

    if (mpClient && mpClient.connected) {
      mpClient.sendVoiceStatus(true, false);
    }

    showToast('🎙️ Virtual Voice Mode activated! Your speaking indicator is live.', 'success');
  }

  updateMicTrackState() {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = !this.isMuted;
      });
    }

    if (mpClient && mpClient.connected) {
      mpClient.sendVoiceStatus(this.isSpeaking && !this.isMuted, this.isMuted);
    }

    this.updateSpeakingVisual(game?.myPlayerId, this.isSpeaking && !this.isMuted);
  }

  setupAudioAnalysis() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(this.localStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);

      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

      if (this.speakingInterval) clearInterval(this.speakingInterval);
      this.speakingInterval = setInterval(() => {
        if (!this.analyser || this.isMuted || this.isVirtual) {
          if (this.isSpeaking && !this.isVirtual) {
            this.isSpeaking = false;
            this.updateSpeakingVisual(game?.myPlayerId, false);
          }
          return;
        }

        this.analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / dataArray.length;
        const speakingNow = avg > 14;

        if (speakingNow !== this.isSpeaking) {
          this.isSpeaking = speakingNow;
          this.updateSpeakingVisual(game?.myPlayerId, this.isSpeaking);
          if (mpClient && mpClient.connected) {
            mpClient.sendVoiceStatus(this.isSpeaking, this.isMuted);
          }
        }
      }, 150);
    } catch (e) {
      console.warn('Audio analysis setup error:', e);
    }
  }

  updateSpeakingVisual(playerId, isSpeaking) {
    if (playerId === undefined || playerId === null) return;
    const card = document.getElementById(`player-status-${playerId}`);
    if (card) {
      card.classList.toggle('speaking', isSpeaking);
    }
  }

  connectPeers() {
    if (!mpClient || !mpClient.connected) return;
    mpClient.sendVoiceStatus(!this.isMuted, this.isMuted);
  }

  handleRemoteVoiceStatus(playerId, isSpeaking, isMuted) {
    this.updateSpeakingVisual(playerId, isSpeaking && !isMuted);
  }

  cleanup() {
    if (this.speakingInterval) clearInterval(this.speakingInterval);
    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop());
      this.localStream = null;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
  }
}

const voiceManager = new VoiceChatManager();
