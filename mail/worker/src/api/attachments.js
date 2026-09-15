// ============================================================
// Attachments API — List, Download, Upload
// ============================================================

import { jsonResponse, pathSegment } from '../router.js';

export async function handleAttachments(request, env, action, ctx) {
  switch (action) {
    case 'list':     return listAttachments(request, env, ctx);
    case 'download': return downloadAttachment(request, env, ctx);
    case 'upload':   return uploadAttachment(request, env, ctx);
    default:         return jsonResponse({ error: 'Unknown action' }, 400);
  }
}

// ── List Attachments for an Email ───────────────────────────

async function listAttachments(request, env, ctx) {
  const emailId = pathSegment(request.url, 2); // /api/emails/:emailId/attachments

  // Verify ownership
  const email = await env.DB.prepare(
    'SELECT id FROM emails WHERE id = ? AND account_id = ?'
  ).bind(emailId, ctx.session.accountId).first();
  if (!email) return jsonResponse({ error: 'Email not found' }, 404);

  const attachments = await env.DB.prepare(
    'SELECT id, filename, content_type, size_bytes, is_inline, content_id FROM attachments WHERE email_id = ?'
  ).bind(emailId).all();

  return jsonResponse({ attachments: attachments.results });
}

// ── Download Single Attachment ──────────────────────────────

async function downloadAttachment(request, env, ctx) {
  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean);
  // /api/emails/:emailId/attachments/:attId
  const emailId = parts[2];
  const attId   = parts[4];

  // Verify ownership
  const email = await env.DB.prepare(
    'SELECT id FROM emails WHERE id = ? AND account_id = ?'
  ).bind(emailId, ctx.session.accountId).first();
  if (!email) return jsonResponse({ error: 'Email not found' }, 404);

  const attachment = await env.DB.prepare(
    'SELECT filename, content_type, r2_key, size_bytes FROM attachments WHERE id = ? AND email_id = ?'
  ).bind(attId, emailId).first();
  if (!attachment) return jsonResponse({ error: 'Attachment not found' }, 404);

  const r2Obj = await env.MAIL_STORE.get(attachment.r2_key);
  if (!r2Obj) return jsonResponse({ error: 'File not found in storage' }, 404);

  const headers = new Headers();
  headers.set('Content-Type', attachment.content_type);
  headers.set('Content-Disposition', `attachment; filename="${attachment.filename}"`);
  headers.set('Content-Length', attachment.size_bytes.toString());
  headers.set('Cache-Control', 'private, max-age=3600');

  return new Response(r2Obj.body, { headers });
}

// ── Upload Attachment (for compose) ─────────────────────────
// Stores file in R2, returns an attachment ID that can be referenced
// when sending/saving a draft.

async function uploadAttachment(request, env, ctx) {
  const contentType = request.headers.get('content-type') || '';

  if (!contentType.includes('multipart/form-data')) {
    return jsonResponse({ error: 'Expected multipart/form-data' }, 400);
  }

  const formData = await request.formData();
  const file = formData.get('file');

  if (!file || !(file instanceof File)) {
    return jsonResponse({ error: 'No file uploaded' }, 400);
  }

  // Size limit: 10 MB per attachment
  if (file.size > 10 * 1024 * 1024) {
    return jsonResponse({ error: 'Attachment too large (max 10 MB)' }, 400);
  }

  const attId = crypto.randomUUID();
  const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
  const r2Key = `uploads/${ctx.session.accountId}/${attId}-${safeFilename}`;

  const buffer = await file.arrayBuffer();
  await env.MAIL_STORE.put(r2Key, buffer, {
    httpMetadata: { contentType: file.type || 'application/octet-stream' },
  });

  // Store metadata in a temporary attachment row (no email_id yet)
  // The email_id will be set when the email is sent or draft saved
  await env.DB.prepare(`
    INSERT INTO attachments (id, email_id, filename, content_type, size_bytes, r2_key)
    VALUES (?1, 'pending', ?2, ?3, ?4, ?5)
  `).bind(attId, file.name || safeFilename, file.type || 'application/octet-stream', file.size, r2Key).run();

  return jsonResponse({
    id: attId,
    filename: file.name,
    contentType: file.type,
    sizeBytes: file.size,
  }, 201);
}
