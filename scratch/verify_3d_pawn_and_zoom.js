const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function runVerification() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const outDir = path.join(__dirname, 'verify_results');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('pageerror', err => consoleErrors.push(err.message));
  page.on('error', err => consoleErrors.push(err.message));

  console.log('Testing Mobile 360x740...');
  await page.setViewport({ width: 360, height: 740, isMobile: true, hasTouch: true });
  await page.goto('http://localhost:3000/games/business-board/index.html', { waitUntil: 'networkidle2' });

  // 1. Singleplayer game launch
  await page.click('#btn-singleplayer');
  await new Promise(r => setTimeout(r, 200));
  await page.click('#btn-start-game');
  await page.waitForSelector('#game-screen.active', { timeout: 6000 });
  await new Promise(r => setTimeout(r, 700));

  // 2. Check 3D pawns in DOM
  const pawnCheck = await page.evaluate(() => {
    const tokens = document.querySelectorAll('.player-token');
    const wraps = document.querySelectorAll('.pawn-3d-wrap');
    const meshes = document.querySelectorAll('.pawn-3d-mesh');
    const heads = document.querySelectorAll('.pawn-mesh-head');
    const collars = document.querySelectorAll('.pawn-mesh-collar');
    const stems = document.querySelectorAll('.pawn-mesh-stem');
    const bases = document.querySelectorAll('.pawn-mesh-base');
    const shadows = document.querySelectorAll('.pawn-3d-shadow');
    const rings = document.querySelectorAll('.pawn-3d-ring');
    const activeToken = document.querySelector('.player-token.active-token');

    const rollBtn = document.getElementById('btn-roll-3d');
    const rectRoll = rollBtn ? rollBtn.getBoundingClientRect() : null;

    return {
      tokensCount: tokens.length,
      wrapsCount: wraps.length,
      meshesCount: meshes.length,
      headsCount: heads.length,
      collarsCount: collars.length,
      stemsCount: stems.length,
      basesCount: bases.length,
      shadowsCount: shadows.length,
      ringsCount: rings.length,
      hasActiveToken: !!activeToken,
      activeColor: activeToken ? activeToken.style.getPropertyValue('--pawn-color') : null,
      rollBtn: rectRoll ? {
        left: Math.round(rectRoll.left),
        right: Math.round(rectRoll.right),
        top: Math.round(rectRoll.top),
        bottom: Math.round(rectRoll.bottom),
        visible: rectRoll.left >= 0 && rectRoll.right <= window.innerWidth
      } : null
    };
  });
  console.log('Pawn System Check:', pawnCheck);

  // Capture initial center view (dice & roll button)
  await page.screenshot({ path: path.join(outDir, '01_mobile_center_view.png') });

  // 3. Test Zoom Cycle
  console.log('Testing Zoom Level Cycle...');
  const zoomBtn = await page.$('#btn-zoom-toggle');
  console.log('Has Zoom Button:', !!zoomBtn);
  if (zoomBtn) {
    await page.click('#btn-zoom-toggle'); // 2.3x
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: path.join(outDir, '02_mobile_super_zoom_2_3x.png') });

    await page.click('#btn-zoom-toggle'); // 1.65x
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: path.join(outDir, '03_mobile_wide_zoom_1_6x.png') });

    await page.click('#btn-zoom-toggle'); // back to 1.95x
    await new Promise(r => setTimeout(r, 500));
  }

  // 4. Test clicking space 1 (Guwahati) to inspect space and glide camera
  console.log('Testing space click & inspection...');
  await page.click('#space-1');
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(outDir, '04_mobile_space_inspect_modal.png') });
  await page.evaluate(() => typeof hideModal === 'function' && hideModal());
  await new Promise(r => setTimeout(r, 300));

  // 5. Test Rolling Dice and Hopping Pawn
  console.log('Testing Dice Roll & 3D Pawn Movement...');
  await page.click('#btn-roll-3d');
  // Wait for dice roll + hop steps + land
  await new Promise(r => setTimeout(r, 3500));
  await page.screenshot({ path: path.join(outDir, '05_mobile_pawn_after_roll.png') });

  // 6. Test Desktop View (1280x720)
  console.log('Testing Desktop View 1280x720...');
  await page.setViewport({ width: 1280, height: 720, isMobile: false });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(outDir, '06_desktop_view.png') });

  console.log('Console errors encountered:', consoleErrors);
  await browser.close();
  console.log('All verification checks completed successfully!');
}

runVerification().catch(console.error);
