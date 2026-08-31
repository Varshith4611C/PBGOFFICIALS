/* ============================================
   PBG Business Board — WebRTC Voice & Speaker Manager
   Full P2P Audio Mesh, Speaker Deafen & Visual Glow
   ============================================ */

class VoiceChatManager {
  constructor() {
    this.localStream = null;
    this.isMuted = true;
    this.isDeafened = false;
    this.isVirtual = false;
    this.isSupported = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    this.peerConnections = new Map(); // playerId -> { pc, audioElement, analyser }
    this.remoteAudios = new Map(); // playerId -> HTMLAudioElement
    this.audioContext = null;
    this.localAnalyser = null;
    this.speakingInterval = null;
    this.isSpeaking = false;

    this.rtcConfig = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };
  }

  // ══════════════════════════════════════════
  // MICROPHONE CONTROLS
  // ══════════════════════════════════════════
  async toggleMic() {
    if (!this.isSupported) {
      showToast('Voice chat is not supported on this browser/device.', 'warning');
      return false;
    }

    if (!this.localStream && !this.isVirtual) {
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

        // Connect audio tracks to all peers in multiplayer room
        this.connectAllPeers();

        showToast('🎙️ Microphone connected! You are now live in voice chat.', 'success');
        return true;
      } else {
        console.warn('Microphone error details:', lastError);
        this.handleMicrophoneError(lastError);
        return false;
      }
    } else if (this.isVirtual) {
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
      showToast(this.isMuted ? '🔇 Microphone muted.' : '🎙️ Microphone live.', 'info');
      return !this.isMuted;
    }
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

  // ══════════════════════════════════════════
  // SPEAKER / DEAFEN CONTROLS
  // ══════════════════════════════════════════
  toggleSpeaker() {
    this.isDeafened = !this.isDeafened;

    // Mute/unmute all incoming peer audio elements
    this.remoteAudios.forEach((audio) => {
      if (audio) {
        audio.muted = this.isDeafened;
      }
    });

    const speakerBtn = document.getElementById('btn-ingame-speaker');
    if (speakerBtn) {
      speakerBtn.classList.toggle('active', !this.isDeafened);
      speakerBtn.innerHTML = `<i class="fas fa-volume-${this.isDeafened ? 'xmark' : 'high'}"></i> <span>Speaker ${this.isDeafened ? 'OFF' : 'ON'}</span>`;
    }

    if (this.isDeafened) {
      showToast('🔇 Speaker muted (Deafened incoming voice).', 'info');
    } else {
      showToast('🔊 Speaker audio active (Hearing players).', 'success');
      // In single player, play a small sample to confirm speakers work
      if (!game || !game.isMultiplayer) {
        this.playSpeakerTestSound();
      }
    }

    return !this.isDeafened;
  }

  playSpeakerTestSound() {
    try {
      sound.playPassGo();
    } catch (e) {}
  }

  // ══════════════════════════════════════════
  // WEBRTC P2P AUDIO STREAMING (PEER MESH)
  // ══════════════════════════════════════════
  connectAllPeers() {
    if (!game || !game.isMultiplayer || !mpClient || !mpClient.connected) return;

    game.players.forEach(p => {
      if (p.id !== game.myPlayerId && !p.isAI) {
        this.initiateCallToPlayer(p.id, p.socketId);
      }
    });
  }

  getOrCreatePeerConnection(playerId, socketId) {
    if (this.peerConnections.has(playerId)) {
      return this.peerConnections.get(playerId).pc;
    }

    const pc = new RTCPeerConnection(this.rtcConfig);

    // Add local microphone stream tracks if available
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        pc.addTrack(track, this.localStream);
      });
    }

    // ICE Candidate handler
    pc.onicecandidate = (event) => {
      if (event.candidate && mpClient && mpClient.connected) {
        mpClient.sendVoiceSignal({
          type: 'candidate',
          targetPlayerId: playerId,
          targetSocketId: socketId,
          candidate: event.candidate
        });
      }
    };

    // Incoming Remote Audio Track
    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      let audio = this.remoteAudios.get(playerId);
      if (!audio) {
        audio = document.createElement('audio');
        audio.autoplay = true;
        audio.id = `remote-audio-player-${playerId}`;
        document.body.appendChild(audio);
        this.remoteAudios.set(playerId, audio);
      }

      audio.srcObject = remoteStream;
      audio.muted = this.isDeafened;
      audio.play().catch(e => console.warn('Auto-play blocked, user interaction required:', e));

      // Setup audio analysis for remote speaker glow
      this.setupRemoteAudioAnalysis(remoteStream, playerId);
    };

    this.peerConnections.set(playerId, { pc, socketId });
    return pc;
  }

  async initiateCallToPlayer(playerId, socketId) {
    try {
      const pc = this.getOrCreatePeerConnection(playerId, socketId);
      const offer = await pc.createOffer({
        offerToReceiveAudio: true
      });
      await pc.setLocalDescription(offer);

      mpClient.sendVoiceSignal({
        type: 'offer',
        targetPlayerId: playerId,
        targetSocketId: socketId,
        sdp: offer
      });
    } catch (err) {
      console.warn(`Failed to initiate call to player ${playerId}:`, err);
    }
  }

  async handleIncomingSignal(data) {
    const fromId = data.fromPlayerId;
    const fromSocketId = data.fromSocketId;

    if (data.type === 'offer') {
      try {
        const pc = this.getOrCreatePeerConnection(fromId, fromSocketId);
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        mpClient.sendVoiceSignal({
          type: 'answer',
          targetPlayerId: fromId,
          targetSocketId: fromSocketId,
          sdp: answer
        });
      } catch (err) {
        console.warn('Error handling voice offer:', err);
      }
    } else if (data.type === 'answer') {
      try {
        const peer = this.peerConnections.get(fromId);
        if (peer && peer.pc) {
          await peer.pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        }
      } catch (err) {
        console.warn('Error handling voice answer:', err);
      }
    } else if (data.type === 'candidate' && data.candidate) {
      try {
        const peer = this.peerConnections.get(fromId);
        if (peer && peer.pc) {
          await peer.pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
      } catch (err) {
        console.warn('Error adding ICE candidate:', err);
      }
    }
  }

  setupRemoteAudioAnalysis(stream, playerId) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      setInterval(() => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / dataArray.length;
        const isSpeaking = avg > 14;
        this.updateSpeakingVisual(playerId, isSpeaking && !this.isDeafened);
      }, 150);
    } catch (e) {
      console.warn('Remote audio analysis error:', e);
    }
  }

  // ══════════════════════════════════════════
  // AUDIO ANALYSIS & SPEAKING DETECTOR
  // ══════════════════════════════════════════
  setupAudioAnalysis() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(this.localStream);
      this.localAnalyser = this.audioContext.createAnalyser();
      this.localAnalyser.fftSize = 256;
      source.connect(this.localAnalyser);

      const dataArray = new Uint8Array(this.localAnalyser.frequencyBinCount);

      if (this.speakingInterval) clearInterval(this.speakingInterval);
      this.speakingInterval = setInterval(() => {
        if (!this.localAnalyser || this.isMuted || this.isVirtual) {
          if (this.isSpeaking && !this.isVirtual) {
            this.isSpeaking = false;
            this.updateSpeakingVisual(game?.myPlayerId, false);
          }
          return;
        }

        this.localAnalyser.getByteFrequencyData(dataArray);
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

  handleRemoteVoiceStatus(playerId, isSpeaking, isMuted) {
    this.updateSpeakingVisual(playerId, isSpeaking && !isMuted && !this.isDeafened);
  }

  handleMicrophoneError(err) {
    const errorName = err?.name || 'Error';
    let title = 'Microphone Access';
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

  cleanup() {
    if (this.speakingInterval) clearInterval(this.speakingInterval);
    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop());
      this.localStream = null;
    }
    this.peerConnections.forEach(({ pc }) => {
      if (pc) pc.close();
    });
    this.peerConnections.clear();
    this.remoteAudios.forEach((audio) => {
      if (audio) audio.remove();
    });
    this.remoteAudios.clear();
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
  }
}

const voiceManager = new VoiceChatManager();
