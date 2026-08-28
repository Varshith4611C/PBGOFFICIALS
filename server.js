const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ── SEO & Security headers ──
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// ── Serve all static files (HTML, CSS, JS, images) from the project root ──
app.use(express.static(path.join(__dirname), {
  extensions: ['html'],          // allows visiting /about → about.html
  index: 'index.html',           // default file for "/"
  dotfiles: 'allow',             // serve .well-known directory
}));

// ── Serve assets folder explicitly ──
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// ── Serve .well-known directory explicitly ──
app.use('/.well-known', express.static(path.join(__dirname, '.well-known')));

// ── Correct MIME type for sitemap ──
app.get('/sitemap.xml', (_req, res) => {
  res.type('application/xml');
  res.sendFile(path.join(__dirname, 'sitemap.xml'));
});

// ── Fallback: send index.html for any unmatched route (SPA-friendly) ──
app.get('/{*path}', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── Start server ──
app.listen(PORT, () => {
  console.log(`\n  ⚡ PBG Officials server running at:\n`);
  console.log(`     Local:   http://localhost:${PORT}`);
  console.log(`     Network: http://0.0.0.0:${PORT}\n`);
});
