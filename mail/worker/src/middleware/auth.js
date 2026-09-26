// ============================================================
// Auth Middleware — validates JWT from Authorization header
// ============================================================

import { verifyToken } from '../lib/crypto.js';

/**
 * Validates the session and returns { accountId, role, sessionId }
 * or null if unauthenticated.
 */
export async function authenticate(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) return null;

  const payload = await verifyToken(token, env.JWT_SECRET);
  if (!payload) return null;

  // Verify session still exists in D1 and account is active
  const session = await env.DB.prepare(`
    SELECT s.id, s.account_id, s.expires_at, a.is_active, a.role
    FROM sessions s
    JOIN accounts a ON s.account_id = a.id
    WHERE s.id = ?
  `).bind(payload.jti).first();

  if (!session || !session.is_active) return null;

  // Check expiry
  if (new Date(session.expires_at) < new Date()) {
    // Clean up expired session
    await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(payload.jti).run();
    return null;
  }

  return {
    accountId: session.account_id,
    role:      session.role || payload.role,
    sessionId: payload.jti,
    address:   payload.address,
  };
}
