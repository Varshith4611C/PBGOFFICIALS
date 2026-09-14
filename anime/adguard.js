/* ============================================
   PBG Anime — AdGuard Shield
   Comprehensive Popup, Redirect & Ad Blocker
   Protects users from streaming server ads
   ============================================ */

(function PBGAdGuard() {
  'use strict';

  const LOG_PREFIX = '[PBG AdGuard]';
  const DEBUG = false;

  function log(...args) {
    if (DEBUG) console.log(LOG_PREFIX, ...args);
  }

  // ── 1. Block Popup Windows ──
  // Override window.open to prevent unauthorized popups
  const _nativeOpen = window.open;
  let userClickActive = false;
  let userClickTimer = null;

  // Track genuine user clicks (only allow popups within 1s of a real click)
  document.addEventListener('click', (e) => {
    const target = e.target.closest('a, button, [data-ep], .streamex-server-card, .ep-grid-btn, .ep-list-btn, .anime-poster-card, .schedule-card, .ranked-item, .search-result-item');
    if (target) {
      userClickActive = true;
      clearTimeout(userClickTimer);
      userClickTimer = setTimeout(() => { userClickActive = false; }, 1200);
    }
  }, true);

  window.open = function (url, name, features) {
    // Allow popups only if triggered by a genuine user click on a trusted element
    if (userClickActive && url && typeof url === 'string') {
      // Allow same-origin links and known safe domains
      try {
        const parsed = new URL(url, window.location.origin);
        if (parsed.origin === window.location.origin) {
          log('Allowed same-origin popup:', url);
          return _nativeOpen.call(window, url, name, features);
        }
      } catch (e) { /* invalid URL, block it */ }
    }
    log('Blocked popup:', url);
    return null;
  };

  // ── 2. Block Background Tab Redirects ──
  let legitimateNavigation = false;

  document.addEventListener('click', (e) => {
    const anchor = e.target.closest('a[href]');
    if (anchor) {
      legitimateNavigation = true;
      setTimeout(() => { legitimateNavigation = false; }, 3000);
    }
  }, true);

  // Intercept location changes from iframes/scripts
  const _origAssign = Object.getOwnPropertyDescriptor(Location.prototype, 'assign');
  const _origReplace = Object.getOwnPropertyDescriptor(Location.prototype, 'replace');

  if (_origAssign && _origAssign.value) {
    Location.prototype.assign = function (url) {
      if (legitimateNavigation || isInternalUrl(url)) {
        return _origAssign.value.call(this, url);
      }
      log('Blocked location.assign redirect:', url);
    };
  }

  if (_origReplace && _origReplace.value) {
    Location.prototype.replace = function (url) {
      if (legitimateNavigation || isInternalUrl(url)) {
        return _origReplace.value.call(this, url);
      }
      log('Blocked location.replace redirect:', url);
    };
  }

  function isInternalUrl(url) {
    if (!url) return false;
    try {
      const parsed = new URL(url, window.location.origin);
      return parsed.origin === window.location.origin;
    } catch {
      return url.startsWith('/') || url.startsWith('#');
    }
  }

  // ── 3. Block Ad Overlay Elements ──
  // MutationObserver to detect and remove injected ad overlays, popups, modals
  const AD_SELECTORS = [
    // Common ad container patterns
    'div[id*="ad-overlay"]',
    'div[id*="popup"]',
    'div[class*="ad-overlay"]',
    'div[class*="popup-ad"]',
    'div[class*="interstitial"]',
    'div[class*="overlay-ad"]',
    'div[class*="click-overlay"]',
    'div[class*="modal-ad"]',
    'div[class*="prebid"]',
    'div[class*="adsbox"]',
    'div[class*="ad-container"]',
    'div[class*="banner-ad"]',
    // Full-screen overlays with high z-index injected by ad scripts
    'iframe[src*="ads"]',
    'iframe[src*="pop"]',
    'iframe[src*="click"]',
    'iframe[src*="track"]',
    'iframe[src*="banner"]',
    // Common ad network elements
    'ins.adsbygoogle',
    'div[data-ad]',
    '[id^="google_ads"]',
    '[id^="div-gpt-ad"]',
  ];

  const AD_SELECTOR_STRING = AD_SELECTORS.join(', ');

  function removeAdElements(root) {
    try {
      const adElements = root.querySelectorAll(AD_SELECTOR_STRING);
      adElements.forEach(el => {
        // Don't remove our own player iframe
        if (el.id === 'playerIframe') return;
        log('Removed ad element:', el.tagName, el.className || el.id);
        el.remove();
      });
    } catch (e) { /* silently fail */ }
  }

  // Also detect full-screen click-hijack overlays (transparent divs covering the page)
  function detectClickHijack(el) {
    if (el.nodeType !== 1) return false; // Not an element
    if (el.id === 'playerIframe' || el.id === 'playerWrapper' || el.id === 'playerLoading') return false;
    if (el.closest('.theatre-player-wrapper')) return false;

    const style = window.getComputedStyle(el);
    const isFixed = style.position === 'fixed' || style.position === 'absolute';
    const isFullCover = (
      parseInt(style.width) >= window.innerWidth * 0.8 &&
      parseInt(style.height) >= window.innerHeight * 0.8
    );
    const isTransparent = parseFloat(style.opacity) < 0.15 || style.backgroundColor === 'transparent';
    const isHighZ = parseInt(style.zIndex) > 9000;

    return isFixed && isFullCover && (isTransparent || isHighZ);
  }

  // Run initial cleanup
  removeAdElements(document);

  // Observe DOM for dynamically injected ad elements
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== 1) continue;

        // Check if the node itself matches ad selectors
        try {
          if (node.matches && node.matches(AD_SELECTOR_STRING)) {
            if (node.id !== 'playerIframe') {
              log('Removed injected ad:', node.tagName, node.className);
              node.remove();
              continue;
            }
          }
        } catch (e) { /* ignore */ }

        // Check for click-hijack overlays
        if (detectClickHijack(node)) {
          log('Removed click-hijack overlay:', node.tagName, node.className);
          node.remove();
          continue;
        }

        // Check children of added nodes
        removeAdElements(node);
      }
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  // ── 4. Block Ad-Related Network Requests ──
  // Known ad/tracker domain patterns
  const BLOCKED_DOMAINS = [
    'doubleclick.net',
    'googlesyndication.com',
    'googleadservices.com',
    'google-analytics.com',
    'adservice.google',
    'pagead2.googlesyndication',
    'amazon-adsystem.com',
    'ads.pubmatic.com',
    'ad.doubleclick',
    'adnxs.com',
    'adsrvr.org',
    'advertising.com',
    'outbrain.com',
    'taboola.com',
    'popads.net',
    'popcash.net',
    'propellerads.com',
    'juicyads.com',
    'exoclick.com',
    'trafficjunky.com',
    'clickadu.com',
    'hilltopads.net',
    'adsterra.com',
    'a-ads.com',
    'ad-maven.com',
    'admaven.com',
    'bidvertiser.com',
    'revcontent.com',
  ];

  function isBlockedUrl(url) {
    if (!url || typeof url !== 'string') return false;
    const lower = url.toLowerCase();
    return BLOCKED_DOMAINS.some(domain => lower.includes(domain));
  }

  // Override fetch to block ad requests
  const _nativeFetch = window.fetch;
  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : (input?.url || '');
    if (isBlockedUrl(url)) {
      log('Blocked fetch to ad domain:', url);
      return Promise.resolve(new Response('', { status: 204 }));
    }
    return _nativeFetch.call(window, input, init);
  };

  // Override XMLHttpRequest to block ad requests
  const _nativeXHROpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...args) {
    if (isBlockedUrl(url)) {
      log('Blocked XHR to ad domain:', url);
      this._blocked = true;
    }
    return _nativeXHROpen.call(this, method, url, ...args);
  };

  const _nativeXHRSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (...args) {
    if (this._blocked) {
      log('Aborted blocked XHR send');
      return;
    }
    return _nativeXHRSend.call(this, ...args);
  };

  // ── 5. Block Notification Permission Requests ──
  // Prevent sites from spamming notification permission dialogs
  if (window.Notification) {
    const _nativeRequestPermission = Notification.requestPermission;
    Notification.requestPermission = function () {
      log('Blocked notification permission request');
      return Promise.resolve('denied');
    };
  }

  // ── 6. Prevent Clipboard Hijacking ──
  // Block scripts from writing to clipboard without user action
  if (navigator.clipboard && navigator.clipboard.writeText) {
    const _nativeWriteText = navigator.clipboard.writeText.bind(navigator.clipboard);
    navigator.clipboard.writeText = function (text) {
      if (userClickActive) {
        return _nativeWriteText(text);
      }
      log('Blocked clipboard hijack attempt');
      return Promise.resolve();
    };
  }

  // ── 7. Block Vibration API Abuse ──
  if (navigator.vibrate) {
    navigator.vibrate = function () {
      log('Blocked vibration API abuse');
      return false;
    };
  }

  // ── 8. Clean URL on Page Load (remove tracking params) ──
  // Strips common tracking parameters from current URL
  function cleanTrackingParams() {
    const url = new URL(window.location.href);
    const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid', 'ref', 'source'];
    let changed = false;
    trackingParams.forEach(param => {
      if (url.searchParams.has(param)) {
        url.searchParams.delete(param);
        changed = true;
      }
    });
    if (changed) {
      window.history.replaceState({}, '', url.toString());
      log('Cleaned tracking parameters from URL');
    }
  }

  cleanTrackingParams();

  // ── 9. Periodic Cleanup Sweep ──
  // Run ad element cleanup every 5 seconds as a safety net
  setInterval(() => {
    removeAdElements(document.body);

    // Also check for any rogue iframes that aren't our player
    document.querySelectorAll('iframe').forEach(iframe => {
      if (iframe.id === 'playerIframe') return;
      // Check if it's a known ad iframe
      const src = (iframe.src || '').toLowerCase();
      if (isBlockedUrl(src) || src.includes('ad') && !src.includes('load') && !src.includes('embed')) {
        log('Removed rogue iframe:', src);
        iframe.remove();
      }
    });
  }, 5000);

  // ── Shield Active Indicator ──
  console.log(`${LOG_PREFIX} 🛡️ AdGuard Shield active — popups, ads, redirects & trackers blocked`);
})();
