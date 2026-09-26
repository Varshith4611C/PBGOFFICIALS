/* ============================================
   PBG ChatBox — Web Audio API Visualizer Engine
   ============================================ */

window.ChatVisualizer = (() => {
  let visualizerAudioCtx = null;
  let visualizerAnalyser = null;
  let visualizerSourceNode = null;
  let visualizerAnimFrame = null;
  let visualizerConnected = false;

  function init({ getAudioEl, isPlayingFn }) {
    const canvas = document.getElementById('musicVisualizerCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const barCount = 18;
    const barWidth = 4;
    const barGap = 3;

    function renderFrame() {
      visualizerAnimFrame = requestAnimationFrame(renderFrame);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const isPlaying = typeof isPlayingFn === 'function' ? isPlayingFn() : false;
      if (!isPlaying) {
        for (let i = 0; i < barCount; i++) {
          const x = i * (barWidth + barGap) + 10;
          ctx.fillStyle = 'rgba(167, 139, 250, 0.2)';
          ctx.fillRect(x, canvas.height - 3, barWidth, 3);
        }
        return;
      }

      let freqData = new Uint8Array(barCount);
      if (visualizerAnalyser && visualizerConnected) {
        const fullData = new Uint8Array(visualizerAnalyser.frequencyBinCount);
        visualizerAnalyser.getByteFrequencyData(fullData);
        for (let i = 0; i < barCount; i++) {
          freqData[i] = fullData[i * 2] || 0;
        }
      } else {
        const now = Date.now() / 250;
        for (let i = 0; i < barCount; i++) {
          const wave = Math.sin(now + i * 0.4) * 0.5 + Math.cos(now * 1.5 - i * 0.2) * 0.5;
          freqData[i] = Math.max(20, Math.floor(((wave + 1) / 2) * 220));
        }
      }

      for (let i = 0; i < barCount; i++) {
        const percent = freqData[i] / 255;
        const barHeight = Math.max(3, percent * (canvas.height - 4));
        const x = i * (barWidth + barGap) + 10;
        const y = canvas.height - barHeight;

        const grad = ctx.createLinearGradient(0, y, 0, canvas.height);
        grad.addColorStop(0, '#a855f7');
        grad.addColorStop(1, '#34d399');

        ctx.fillStyle = grad;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, y, barWidth, barHeight, [2, 2, 0, 0]);
        } else {
          ctx.rect(x, y, barWidth, barHeight);
        }
        ctx.fill();
      }
    }

    renderFrame();

    const tryConnectAudio = () => {
      const audioEl = typeof getAudioEl === 'function' ? getAudioEl() : null;
      if (visualizerConnected || !audioEl) return;
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        if (!visualizerAudioCtx) visualizerAudioCtx = new AudioContextClass();
        if (visualizerAudioCtx.state === 'suspended') visualizerAudioCtx.resume();

        visualizerAnalyser = visualizerAudioCtx.createAnalyser();
        visualizerAnalyser.fftSize = 64;
        visualizerAnalyser.smoothingTimeConstant = 0.8;

        visualizerSourceNode = visualizerAudioCtx.createMediaElementSource(audioEl);
        visualizerSourceNode.connect(visualizerAnalyser);
        visualizerAnalyser.connect(visualizerAudioCtx.destination);
        visualizerConnected = true;
      } catch (err) {
        visualizerConnected = false;
      }
    };

    window.addEventListener('click', tryConnectAudio, { once: true });
    window.addEventListener('touchend', tryConnectAudio, { once: true });
  }

  return { init };
})();
