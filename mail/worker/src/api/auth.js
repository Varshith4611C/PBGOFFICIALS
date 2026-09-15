// ============================================================
// Auth API — Login, Logout, Setup, Me
// ============================================================

import { hashPassword, verifyPassword, createToken } from '../lib/crypto.js';
import { jsonResponse } from '../router.js';

export async function handleAuth(request, env, action, ctx) {
  switch (action) {
    case 'setup': return setup(request, env);
    case 'login': return login(request, env);
    case 'logout': return logout(request, env, ctx);
    case 'me': return me(request, env, ctx);
    default: return jsonResponse({ error: 'Unknown auth action' }, 400);
  }
}

// ── Initial Admin Setup ─────────────────────────────────────
// One-time route: creates the first admin account.
// Requires the ADMIN_SETUP_KEY secret.

async function setup(request, env) {
  const body = await request.json();
  const { setupKey, address, displayName, password } = body;

  if (!setupKey || setupKey !== env.ADMIN_SETUP_KEY) {
    return jsonResponse({ error: 'Invalid setup key' }, 403);
  }

  // Ensure no accounts exist yet (one-time setup)
  const existing = await env.DB.prepare('SELECT COUNT(*) as count FROM accounts').first();
  if (existing.count > 0) {
    return jsonResponse({ error: 'Setup already completed. Use admin account to create more.' }, 400);
  }

  if (!address || !password || password.length < 8) {
    return jsonResponse({ error: 'Address and password (8+ chars) required' }, 400);
  }

  const fullAddress = address.includes('@') ? address.toLowerCase() : `${address.toLowerCase()}@${env.DOMAIN}`;
  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(password);

  await env.DB.prepare(`
    INSERT INTO accounts (id, address, display_name, password_hash, role)
    VALUES (?1, ?2, ?3, ?4, 'admin')
  `).bind(id, fullAddress, displayName || '', passwordHash).run();

  return jsonResponse({ ok: true, account: { id, address: fullAddress, role: 'admin' } }, 201);
}

// ── Login ───────────────────────────────────────────────────

async function login(request, env) {
  const body = await request.json();
  let { address, password } = body;

  if (!address || !password) {
    return jsonResponse({ error: 'Email and password required' }, 400);
  }

  address = address.includes('@') ? address.toLowerCase() : `${address.toLowerCase()}@${env.DOMAIN}`;

  const account = await env.DB.prepare(
    'SELECT id, address, display_name, password_hash, role, is_active FROM accounts WHERE address = ?'
  ).bind(address).first();

  if (!account || !account.is_active) {
    return jsonResponse({ error: 'Invalid credentials' }, 401);
  }

  const valid = await verifyPassword(password, account.password_hash);
  if (!valid) {
    return jsonResponse({ error: 'Invalid credentials' }, 401);
  }

  // Create JWT
  const { token, jti, expiresAt } = await createToken(
    { sub: account.id, address: account.address, role: account.role },
    env.JWT_SECRET,
    24 * 7 // 7 days
  );

  // Store session in D1 for revocation
  const userAgent = request.headers.get('user-agent') || '';
  const ip = request.headers.get('cf-connecting-ip') || '';

  await env.DB.prepare(`
    INSERT INTO sessions (id, account_id, user_agent, ip_address, expires_at)
    VALUES (?1, ?2, ?3, ?4, ?5)
  `).bind(jti, account.id, userAgent, ip, expiresAt).run();

  // Clean up old expired sessions for this account (housekeeping)
  await env.DB.prepare(
    "DELETE FROM sessions WHERE account_id = ? AND expires_at < datetime('now')"
  ).bind(account.id).run();

  return jsonResponse({
    token,
    expiresAt,
    account: {
      id: account.id,
      address: account.address,
      displayName: account.display_name,
      role: account.role,
    },
  });
}

// ── Logout ──────────────────────────────────────────────────

async function logout(request, env, ctx) {
  await env.DB.prepare('DELETE FROM sessions WHERE id = ?')
    .bind(ctx.session.sessionId).run();
  return jsonResponse({ ok: true });
}

// ── Me ──────────────────────────────────────────────────────

async function me(request, env, ctx) {
  const account = await env.DB.prepare(
    'SELECT id, address, display_name, role, storage_used, created_at FROM accounts WHERE id = ?'
  ).bind(ctx.session.accountId).first();

  if (!account) {
    return jsonResponse({ error: 'Account not found' }, 404);
  }

  return jsonResponse({
    id: account.id,
    address: account.address,
    displayName: account.display_name,
    role: account.role,
    storageUsed: account.storage_used,
    createdAt: account.created_at,
  });
}
