const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function testCameraAndPawn() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 360, height: 740, isMobile: true });
  await page.goto('http://localhost:3000/games/business-board/index.html', { waitUntil: 'networkidle2' });
  await page.click('#btn-singleplayer');
  await new Promise(r => setTimeout(r, 200));
  await page.click('#btn-start-game');
  await page.waitForSelector('#game-screen.active', { timeout: 6000 });

  // Add 3D Pawn CSS styles and enlarged space font
  await page.addStyleTag({
    content: `
      :root {
        --cam-zoom: 1.95 !important;
      }
      .space-content {
        padding: 1px 0.5px !important;
      }
      .space-name {
        font-size: clamp(0.38rem, 1.05vw, 0.58rem) !important;
        font-weight: 800 !important;
        color: #150602 !important;
        line-height: 1.05 !important;
        letter-spacing: -0.25px !important;
        word-break: break-word !important;
        overflow-wrap: break-word !important;
      }
      .space-price {
        font-size: clamp(0.38rem, 1.0vw, 0.55rem) !important;
        font-weight: 800 !important;
        color: #271406 !important;
        margin-top: 1px !important;
      }
      .space-icon {
        font-size: clamp(0.75rem, 1.8vw, 1.15rem) !important;
        margin-bottom: 0px !important;
      }
      .player-token {
        position: relative !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        transform-style: preserve-3d !important;
        margin: 0 1px !important;
      }
      .pawn-3d-wrap {
        position: relative;
        width: 24px;
        height: 36px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-end;
        transform-style: preserve-3d;
      }
      .board-camera-rig.camera-follow .pawn-3d-wrap {
        transform: rotateX(-34deg) translateZ(10px);
        transform-origin: center bottom;
      }
      .board-camera-rig.camera-full .pawn-3d-wrap {
        transform: rotateX(0deg) translateZ(4px);
        transform-origin: center bottom;
      }
      .pawn-3d-shadow {
        position: absolute;
        bottom: -2px;
        width: 20px;
        height: 8px;
        background: radial-gradient(ellipse at center, rgba(0, 0, 0, 0.75) 0%, rgba(0, 0, 0, 0.25) 60%, transparent 80%);
        border-radius: 50%;
        transform: rotateX(34deg) translateZ(-2px);
        pointer-events: none;
      }
      .pawn-3d-ring {
        position: absolute;
        bottom: -4px;
        width: 24px;
        height: 10px;
        border-radius: 50%;
        border: 2px solid var(--pawn-color, #fbbf24);
        box-shadow: 0 0 8px var(--pawn-color, #fbbf24);
        opacity: 0;
        transform: rotateX(34deg) translateZ(-1px);
        pointer-events: none;
        transition: opacity 0.3s ease;
      }
      .player-token.active-token .pawn-3d-ring {
        opacity: 1;
        animation: pawnRingPulse 1.2s infinite alternate ease-in-out;
      }
      @keyframes pawnRingPulse {
        from { transform: rotateX(34deg) scale(0.85); opacity: 0.6; }
        to { transform: rotateX(34deg) scale(1.2); opacity: 1; }
      }
      .pawn-3d-mesh {
        position: relative;
        width: 18px;
        height: 32px;
        display: flex;
        flex-direction: column;
        align-items: center;
        transform-style: preserve-3d;
        filter: drop-shadow(0 4px 5px rgba(0,0,0,0.85));
      }
      .pawn-mesh-head {
        width: 13px;
        height: 13px;
        border-radius: 50%;
        background: radial-gradient(circle at 35% 28%, #ffffff 0%, var(--pawn-color, #ef4444) 42%, #110505 100%);
        box-shadow: inset -1.5px -2px 3px rgba(0, 0, 0, 0.75), inset 1.5px 1.5px 2px rgba(255, 255, 255, 0.9), 0 2px 4px rgba(0,0,0,0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        z-index: 3;
      }
      .pawn-mesh-head i {
        font-size: 6.5px;
        color: rgba(255, 255, 255, 0.95);
        filter: drop-shadow(0 1px 1px rgba(0,0,0,0.9));
      }
      .pawn-mesh-collar {
        width: 10px;
        height: 3px;
        border-radius: 2px;
        background: linear-gradient(90deg, #ca8a04 0%, #fef08a 50%, #92400e 100%);
        box-shadow: 0 1px 2px rgba(0,0,0,0.6);
        margin-top: -1px;
        z-index: 2;
      }
      .pawn-mesh-stem {
        width: 9px;
        height: 7px;
        background: linear-gradient(90deg, rgba(0,0,0,0.6) 0%, rgba(255,255,255,0.4) 30%, var(--pawn-color, #ef4444) 60%, rgba(0,0,0,0.7) 100%);
        clip-path: polygon(25% 0%, 75% 0%, 100% 100%, 0% 100%);
        margin-top: -1px;
        z-index: 1;
      }
      .pawn-mesh-base {
        width: 18px;
        height: 7px;
        border-radius: 50%;
        background: radial-gradient(ellipse at 35% 30%, #ffffff 0%, var(--pawn-color, #ef4444) 45%, #0f0505 100%);
        box-shadow: inset -1px -2px 3px rgba(0,0,0,0.7), inset 1px 1px 2px rgba(255,255,255,0.85), 0 3px 5px rgba(0,0,0,0.9);
        margin-top: -2px;
        z-index: 2;
      }
      .player-token.active-token .pawn-3d-wrap {
        animation: pawnHop3D 1.3s infinite alternate ease-in-out;
      }
      @keyframes pawnHop3D {
        0% { transform: rotateX(-34deg) translateZ(8px) translateY(0); }
        100% { transform: rotateX(-34deg) translateZ(20px) translateY(-6px); }
      }
    `
  });

  // Inject updated updateCameraPosition and renderTokens
  await page.evaluate(() => {
    game.updateCameraPosition = function(target) {
      const rig = document.getElementById('board-camera-rig');
      if (!rig) return;

      if (this.cameraMode === 'full') {
        rig.style.setProperty('--cam-pan-x', '0px');
        rig.style.setProperty('--cam-pan-y', '0px');
        return;
      }

      const boardEl = document.getElementById('board');
      const size = boardEl && boardEl.offsetWidth > 0 ? boardEl.offsetWidth : 380;
      const isMobile = window.innerWidth < 640;

      // Center view: focus directly on the dice and roll button
      if (target === 'center') {
        const centerPanY = -Math.round(size * (isMobile ? 0.05 : 0.10));
        rig.style.setProperty('--cam-pan-x', '0px');
        rig.style.setProperty('--cam-pan-y', centerPanY + 'px');
        return;
      }

      const spaceId = typeof target === 'number' ? target : 0;
      const pos = GRID_POSITIONS[spaceId] || { row: 11, col: 11 };
      let xFr = pos.col === 1 ? 0.675 : (pos.col === 11 ? 11.025 : (pos.col - 0.15));
      let yFr = pos.row === 1 ? 0.675 : (pos.row === 11 ? 11.025 : (pos.row - 0.15));

      let normX = (xFr / 11.7 - 0.5) * 2;
      let normY = (yFr / 11.7 - 0.5) * 2;

      // Unclamped pan factor so the active space moves towards screen center
      const panFactorX = isMobile ? 0.32 : 0.28;
      const panFactorY = isMobile ? 0.28 : 0.26;

      let panX = -normX * (size * panFactorX);
      let panY = -normY * (size * panFactorY);

      rig.style.setProperty('--cam-pan-x', Math.round(panX) + 'px');
      rig.style.setProperty('--cam-pan-y', Math.round(panY) + 'px');
    };

    game.renderTokens = function() {
      BOARD_SPACES.forEach(space => {
        const cont = document.getElementById('tokens-' + space.id);
        if (cont) cont.innerHTML = '';
      });
      const posGroups = {};
      this.activePlayers.forEach(p => {
        if (!posGroups[p.position]) posGroups[p.position] = [];
        posGroups[p.position].push(p);
      });
      Object.entries(posGroups).forEach(([posStr, playersAtPos]) => {
        const cont = document.getElementById('tokens-' + posStr);
        if (!cont) return;
        playersAtPos.forEach(p => {
          const token = document.createElement('div');
          token.className = 'player-token ' + (p.id === this.currentPlayerIndex ? 'active-token' : '') + (p.inJail ? ' token-in-jail' : '');
          token.style.setProperty('--pawn-color', p.color);
          token.innerHTML = `
            <div class="pawn-3d-wrap" title="${p.name}">
              <div class="pawn-3d-ring"></div>
              <div class="pawn-3d-shadow"></div>
              <div class="pawn-3d-mesh">
                <div class="pawn-mesh-head">
                  <i class="fa-solid ${p.tokenIcon || 'fa-chess-pawn'}"></i>
                </div>
                <div class="pawn-mesh-collar"></div>
                <div class="pawn-mesh-stem"></div>
                <div class="pawn-mesh-base"></div>
              </div>
            </div>
          `;
          cont.appendChild(token);
        });
      });
    };

    game.renderTokens();
    // Move camera to space 0 (where pawns start!)
    game.updateCameraPosition(0);
  });

  await new Promise(r => setTimeout(r, 900));
  await page.screenshot({ path: 'scratch/test_pawns_on_go.png' });
  console.log('Saved pawns on GO screenshot to scratch/test_pawns_on_go.png');

  // Now focus back on center
  await page.evaluate(() => game.updateCameraPosition('center'));
  await new Promise(r => setTimeout(r, 900));
  await page.screenshot({ path: 'scratch/test_pawns_on_center.png' });
  console.log('Saved pawns on center screenshot to scratch/test_pawns_on_center.png');

  // Now step move 3 steps to see walking
  await page.evaluate(async () => {
    await game.stepMovePlayer(game.players[0], 3, true);
  });
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: 'scratch/test_pawns_stepped.png' });
  console.log('Saved stepped pawns screenshot to scratch/test_pawns_stepped.png');

  await browser.close();
}

testCameraAndPawn().catch(console.error);
