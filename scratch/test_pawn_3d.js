const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function testPawn() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 360, height: 740, isMobile: true });
  await page.goto('http://localhost:3000/games/business-board/index.html', { waitUntil: 'networkidle2' });
  await page.click('#btn-singleplayer');
  await new Promise(r => setTimeout(r, 250));
  await page.click('#btn-start-game');
  await page.waitForSelector('#game-screen.active', { timeout: 6000 });

  // Add 3D Pawn CSS styles and enlarged space font
  await page.addStyleTag({
    content: `
      :root {
        --cam-zoom: 1.95 !important;
      }
      .space-name {
        font-size: clamp(0.48rem, 1.4vw, 0.72rem) !important;
        font-weight: 800 !important;
        color: #1a0802 !important;
      }
      .space-price {
        font-size: clamp(0.42rem, 1.3vw, 0.65rem) !important;
        font-weight: 800 !important;
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
        width: 26px;
        height: 38px;
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
      .pawn-3d-shadow {
        position: absolute;
        bottom: -2px;
        width: 22px;
        height: 9px;
        background: radial-gradient(ellipse at center, rgba(0, 0, 0, 0.75) 0%, rgba(0, 0, 0, 0.25) 60%, transparent 80%);
        border-radius: 50%;
        transform: rotateX(34deg) translateZ(-2px);
        pointer-events: none;
      }
      .pawn-3d-ring {
        position: absolute;
        bottom: -4px;
        width: 28px;
        height: 12px;
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
        width: 20px;
        height: 34px;
        display: flex;
        flex-direction: column;
        align-items: center;
        transform-style: preserve-3d;
        filter: drop-shadow(0 4px 5px rgba(0,0,0,0.85));
      }
      .pawn-mesh-head {
        width: 14px;
        height: 14px;
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
        font-size: 7px;
        color: rgba(255, 255, 255, 0.95);
        filter: drop-shadow(0 1px 1px rgba(0,0,0,0.9));
      }
      .pawn-mesh-collar {
        width: 11px;
        height: 3px;
        border-radius: 2px;
        background: linear-gradient(90deg, #ca8a04 0%, #fef08a 50%, #92400e 100%);
        box-shadow: 0 1px 2px rgba(0,0,0,0.6);
        margin-top: -1px;
        z-index: 2;
      }
      .pawn-mesh-stem {
        width: 10px;
        height: 8px;
        background: linear-gradient(90deg, rgba(0,0,0,0.6) 0%, rgba(255,255,255,0.4) 30%, var(--pawn-color, #ef4444) 60%, rgba(0,0,0,0.7) 100%);
        clip-path: polygon(25% 0%, 75% 0%, 100% 100%, 0% 100%);
        margin-top: -1px;
        z-index: 1;
      }
      .pawn-mesh-base {
        width: 20px;
        height: 8px;
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
        100% { transform: rotateX(-34deg) translateZ(22px) translateY(-8px); }
      }
    `
  });

  // Re-render tokens using 3D pawn structure
  await page.evaluate(() => {
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
          token.className = `player-token ${p.id === this.currentPlayerIndex ? 'active-token' : ''} ${p.inJail ? 'token-in-jail' : ''}`;
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
    game.updateCameraPosition(0);
  });

  await new Promise(r => setTimeout(r, 800));
  const outPath = path.join(__dirname, 'test_3d_pawn_mobile.png');
  await page.screenshot({ path: outPath });
  console.log('Saved 3D pawn screenshot to:', outPath);
  await browser.close();
}

testPawn().catch(console.error);
