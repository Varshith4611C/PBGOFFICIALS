// ============================================================
// Accounts API — Admin-only account management
// ============================================================

import { hashPassword } from '../lib/crypto.js';
import { jsonResponse, pathSegment } from '../router.js';

export async function handleAccounts(request, env, action, ctx) {
  // Only admins can manage accounts
  if (ctx.session.role !== 'admin') {
    return jsonResponse({ error: 'Admin access required' }, 403);
  }

  switch (action) {
    case 'list':   return listAccounts(env, ctx);
    case 'create': return createAccount(request, env, ctx);
    case 'update': return updateAccount(request, env, ctx);
    case 'delete': return deleteAccount(request, env, ctx);
    default:       return jsonResponse({ error: 'Unknown action' }, 400);
  }
}

// ── List All Accounts ───────────────────────────────────────

async function listAccounts(env, ctx) {
  const accounts = await env.DB.prepare(`
    SELECT id, address, display_name, role, is_active, storage_used, created_at
    FROM accounts
    ORDER BY created_at ASC
  `).all();

  return jsonResponse({ accounts: accounts.results });
}

// ── Create Account ──────────────────────────────────────────

async function createAccount(request, env, ctx) {
  const body = await request.json();
  const { address, displayName, password, role } = body;

  if (!address || !password || password.length < 8) {
    return jsonResponse({ error: 'Address and password (8+ chars) required' }, 400);
  }

  const fullAddress = address.includes('@')
    ? address.toLowerCase()
    : `${address.toLowerCase()}@${env.DOMAIN}`;

  // Check domain
  if (!fullAddress.endsWith(`@${env.DOMAIN}`)) {
    return jsonResponse({ error: `Address must be @${env.DOMAIN}` }, 400);
  }

  // Check uniqueness
  const existing = await env.DB.prepare(
    'SELECT id FROM accounts WHERE address = ?'
  ).bind(fullAddress).first();
  if (existing) {
    return jsonResponse({ error: 'Address already exists' }, 409);
  }

  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  const accountRole = role === 'admin' ? 'admin' : 'user';

  await env.DB.prepare(`
    INSERT INTO accounts (id, address, display_name, password_hash, role)
    VALUES (?1, ?2, ?3, ?4, ?5)
  `).bind(id, fullAddress, displayName || '', passwordHash, accountRole).run();

  return jsonResponse({
    ok: true,
    account: { id, address: fullAddress, displayName, role: accountRole },
  }, 201);
}

// ── Update Account ──────────────────────────────────────────

async function updateAccount(request, env, ctx) {
  const accountId = pathSegment(request.url, 2);
  const body = await request.json();
  const { displayName, password, role, isActive } = body;

  const existing = await env.DB.prepare(
    'SELECT id FROM accounts WHERE id = ?'
  ).bind(accountId).first();
  if (!existing) return jsonResponse({ error: 'Account not found' }, 404);

  const updates = [];
  const values = [];
  let idx = 1;

  if (displayName !== undefined) {
    updates.push(`display_name = ?${idx}`);
    values.push(displayName);
    idx++;
  }
  if (password) {
    if (password.length < 8) return jsonResponse({ error: 'Password must be 8+ chars' }, 400);
    updates.push(`password_hash = ?${idx}`);
    values.push(await hashPassword(password));
    idx++;
  }
  if (role !== undefined) {
    updates.push(`role = ?${idx}`);
    values.push(role === 'admin' ? 'admin' : 'user');
    idx++;
  }
  if (isActive !== undefined) {
    updates.push(`is_active = ?${idx}`);
    values.push(isActive ? 1 : 0);
    idx++;
  }

  if (updates.length === 0) {
    return jsonResponse({ error: 'No updates provided' }, 400);
  }

  updates.push(`updated_at = datetime('now')`);
  values.push(accountId);

  await env.DB.prepare(
    `UPDATE accounts SET ${updates.join(', ')} WHERE id = ?${idx}`
  ).bind(...values).run();

  // If deactivated, revoke all sessions
  if (isActive === false) {
    await env.DB.prepare('DELETE FROM sessions WHERE account_id = ?').bind(accountId).run();
  }

  return jsonResponse({ ok: true });
}

// ── Delete Account ──────────────────────────────────────────

async function deleteAccount(request, env, ctx) {
  const accountId = pathSegment(request.url, 2);

  // Prevent self-deletion
  if (accountId === ctx.session.accountId) {
    return jsonResponse({ error: 'Cannot delete your own account' }, 400);
  }

  const existing = await env.DB.prepare(
    'SELECT id, address FROM accounts WHERE id = ?'
  ).bind(accountId).first();
  if (!existing) return jsonResponse({ error: 'Account not found' }, 404);

  // Delete all R2 data for this account
  // (In production you'd want a background job for this;
  //  for now we delete the D1 rows and note that R2 cleanup is deferred)

  // Delete D1 data (cascade handles emails, attachments, sessions, contacts, threads)
  await env.DB.prepare('DELETE FROM sessions WHERE account_id = ?').bind(accountId).run();
  await env.DB.prepare('DELETE FROM contacts WHERE account_id = ?').bind(accountId).run();

  // Delete attachments for this account's emails
  await env.DB.prepare(`
    DELETE FROM attachments WHERE email_id IN (SELECT id FROM emails WHERE account_id = ?)
  `).bind(accountId).run();

  await env.DB.prepare('DELETE FROM emails WHERE account_id = ?').bind(accountId).run();
  await env.DB.prepare('DELETE FROM threads WHERE account_id = ?').bind(accountId).run();
  await env.DB.prepare('DELETE FROM accounts WHERE id = ?').bind(accountId).run();

  return jsonResponse({ ok: true, deleted: existing.address });
}
