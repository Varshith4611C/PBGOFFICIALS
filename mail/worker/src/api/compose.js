// ============================================================
// Compose API — Send, Reply, Forward, Drafts
// Uses Resend API for outbound delivery.
// ============================================================

import { jsonResponse, pathSegment } from '../router.js';

export async function handleCompose(request, env, action, ctx) {
  switch (action) {
    case 'send':        return sendEmail(request, env, ctx);
    case 'reply':       return replyEmail(request, env, ctx);
    case 'forward':     return forwardEmail(request, env, ctx);
    case 'saveDraft':   return saveDraft(request, env, ctx);
    case 'updateDraft': return updateDraft(request, env, ctx);
    case 'deleteDraft': return deleteDraft(request, env, ctx);
    default:            return jsonResponse({ error: 'Unknown compose action' }, 400);
  }
}

// ── Send New Email ──────────────────────────────────────────

async function sendEmail(request, env, ctx) {
  const body = await request.json();
  const { to, cc, bcc, subject, htmlBody, textBody, attachmentIds } = body;

  if (!to || to.length === 0) {
    return jsonResponse({ error: 'At least one recipient (to) is required' }, 400);
  }
  if (!subject && !htmlBody && !textBody) {
    return jsonResponse({ error: 'Subject or body required' }, 400);
  }

  // Get sender account
  const account = await env.DB.prepare(
    'SELECT address, display_name FROM accounts WHERE id = ?'
  ).bind(ctx.session.accountId).first();

  const fromStr = account.display_name
    ? `${account.display_name} <${account.address}>`
    : account.address;

  // Resolve draft attachments from R2 if any
  const attachments = await resolveAttachments(env, attachmentIds || []);

  // Send via Resend
  const result = await sendViaResend(env, {
    from: fromStr,
    to: normalizeRecipients(to),
    cc: normalizeRecipients(cc),
    bcc: normalizeRecipients(bcc),
    subject: subject || '(no subject)',
    html: htmlBody || undefined,
    text: textBody || undefined,
    attachments,
    replyTo: account.address,
  });

  if (!result.ok) {
    return jsonResponse({ error: 'Failed to send email', details: result.error }, 500);
  }

  // Store in "sent" folder
  const emailId = crypto.randomUUID();
  const messageId = result.messageId || `<${emailId}@${env.DOMAIN}>`;

  // Store raw representation in R2
  const sentData = JSON.stringify({ from: fromStr, to, cc, bcc, subject, htmlBody, textBody });
  const r2Key = `sent/${ctx.session.accountId}/${emailId}.json`;
  await env.MAIL_STORE.put(r2Key, sentData, {
    httpMetadata: { contentType: 'application/json' },
  });

  await env.DB.prepare(`
    INSERT INTO emails (
      id, account_id, message_id,
      from_address, from_name, to_address, cc_address, bcc_address,
      subject, snippet, text_body, html_body, r2_key, size_bytes,
      folder, is_read, is_parsed, date
    ) VALUES (
      ?1, ?2, ?3,
      ?4, ?5, ?6, ?7, ?8,
      ?9, ?10, ?11, ?12, ?13, ?14,
      'sent', 1, 1, datetime('now')
    )
  `).bind(
    emailId, ctx.session.accountId, messageId,
    account.address, account.display_name || '', JSON.stringify(normalizeRecipients(to)),
    JSON.stringify(normalizeRecipients(cc || [])), JSON.stringify(normalizeRecipients(bcc || [])),
    subject || '(no subject)', (textBody || '').slice(0, 200),
    (textBody || '').slice(0, 65536), (htmlBody || '').slice(0, 65536),
    r2Key, sentData.length,
  ).run();

  // Update contacts
  for (const addr of [...(to || []), ...(cc || []), ...(bcc || [])]) {
    await upsertContact(env, ctx.session.accountId, typeof addr === 'string' ? addr : addr.address, typeof addr === 'string' ? '' : addr.name);
  }

  return jsonResponse({ ok: true, emailId, messageId });
}

// ── Reply ───────────────────────────────────────────────────

async function replyEmail(request, env, ctx) {
  const body = await request.json();
  const { emailId, htmlBody, textBody, replyAll, cc: extraCc, attachmentIds } = body;

  // Fetch original email
  const original = await env.DB.prepare(
    'SELECT * FROM emails WHERE id = ? AND account_id = ?'
  ).bind(emailId, ctx.session.accountId).first();

  if (!original) return jsonResponse({ error: 'Original email not found' }, 404);

  const account = await env.DB.prepare(
    'SELECT address, display_name FROM accounts WHERE id = ?'
  ).bind(ctx.session.accountId).first();

  // Determine recipients
  const replyTo = original.reply_to || original.from_address;
  let to = [replyTo];
  let cc = [];

  if (replyAll) {
    // Add all original recipients except self
    const originalTo = safeParse(original.to_address);
    const originalCc = safeParse(original.cc_address);
    const allAddrs = [...originalTo, ...originalCc]
      .map(a => typeof a === 'string' ? a : a.address)
      .filter(a => a && a.toLowerCase() !== account.address.toLowerCase());
    cc = [...allAddrs, ...(extraCc || [])];
  }

  // Build threading headers
  const inReplyTo = original.message_id || '';
  const references = [original.references, original.message_id].filter(Boolean).join(' ');
  const subject = original.subject.match(/^re:/i) ? original.subject : `Re: ${original.subject}`;

  const fromStr = account.display_name
    ? `${account.display_name} <${account.address}>`
    : account.address;

  const attachments = await resolveAttachments(env, attachmentIds || []);

  const result = await sendViaResend(env, {
    from: fromStr,
    to: normalizeRecipients(to),
    cc: normalizeRecipients(cc),
    subject,
    html: htmlBody || undefined,
    text: textBody || undefined,
    attachments,
    replyTo: account.address,
    headers: {
      'In-Reply-To': inReplyTo,
      'References': references,
    },
  });

  if (!result.ok) {
    return jsonResponse({ error: 'Failed to send reply', details: result.error }, 500);
  }

  // Store in sent folder with threading
  const replyId = crypto.randomUUID();
  const r2Key = `sent/${ctx.session.accountId}/${replyId}.json`;
  await env.MAIL_STORE.put(r2Key, JSON.stringify({ from: fromStr, to, cc, subject, htmlBody, textBody }));

  await env.DB.prepare(`
    INSERT INTO emails (
      id, account_id, message_id, in_reply_to, "references", thread_id,
      from_address, from_name, to_address, cc_address,
      subject, snippet, text_body, html_body, r2_key,
      folder, is_read, is_parsed, date
    ) VALUES (
      ?1, ?2, ?3, ?4, ?5, ?6,
      ?7, ?8, ?9, ?10,
      ?11, ?12, ?13, ?14, ?15,
      'sent', 1, 1, datetime('now')
    )
  `).bind(
    replyId, ctx.session.accountId, result.messageId || `<${replyId}@${env.DOMAIN}>`,
    inReplyTo, references, original.thread_id,
    account.address, account.display_name || '',
    JSON.stringify(normalizeRecipients(to)), JSON.stringify(normalizeRecipients(cc)),
    subject, (textBody || '').slice(0, 200),
    (textBody || '').slice(0, 65536), (htmlBody || '').slice(0, 65536), r2Key,
  ).run();

  // Update thread
  if (original.thread_id) {
    await env.DB.prepare(`
      UPDATE threads SET last_date = datetime('now'), message_count = message_count + 1
      WHERE id = ?
    `).bind(original.thread_id).run();
  }

  return jsonResponse({ ok: true, emailId: replyId });
}

// ── Forward ─────────────────────────────────────────────────

async function forwardEmail(request, env, ctx) {
  const body = await request.json();
  const { emailId, to, cc, htmlBody, textBody, includeAttachments } = body;

  if (!to || to.length === 0) {
    return jsonResponse({ error: 'At least one recipient required' }, 400);
  }

  const original = await env.DB.prepare(
    'SELECT * FROM emails WHERE id = ? AND account_id = ?'
  ).bind(emailId, ctx.session.accountId).first();
  if (!original) return jsonResponse({ error: 'Original email not found' }, 404);

  const account = await env.DB.prepare(
    'SELECT address, display_name FROM accounts WHERE id = ?'
  ).bind(ctx.session.accountId).first();

  const subject = original.subject.match(/^fwd?:/i) ? original.subject : `Fwd: ${original.subject}`;
  const fromStr = account.display_name
    ? `${account.display_name} <${account.address}>`
    : account.address;

  // Include original attachments if requested
  let attachments = [];
  if (includeAttachments) {
    const origAttachments = await env.DB.prepare(
      'SELECT id, filename, content_type, r2_key FROM attachments WHERE email_id = ?'
    ).bind(emailId).all();

    for (const att of origAttachments.results) {
      const obj = await env.MAIL_STORE.get(att.r2_key);
      if (obj) {
        const content = await obj.arrayBuffer();
        attachments.push({
          filename: att.filename,
          content: arrayBufferToBase64(content),
          content_type: att.content_type,
        });
      }
    }
  }

  // Build forwarded body
  const fwdHeader = `\n\n---------- Forwarded message ----------\nFrom: ${original.from_name} <${original.from_address}>\nDate: ${original.date}\nSubject: ${original.subject}\nTo: ${original.to_address}\n\n`;

  const finalTextBody = (textBody || '') + fwdHeader + (original.text_body || '');
  const finalHtmlBody = (htmlBody || '') +
    `<br><br><div style="border-left:2px solid #ccc;padding-left:12px;margin-left:8px;color:#666">` +
    `<p><b>---------- Forwarded message ----------</b><br>` +
    `From: ${escapeHtml(original.from_name || '')} &lt;${escapeHtml(original.from_address)}&gt;<br>` +
    `Date: ${escapeHtml(original.date)}<br>` +
    `Subject: ${escapeHtml(original.subject)}<br></p>` +
    `${original.html_body || escapeHtml(original.text_body || '')}</div>`;

  const result = await sendViaResend(env, {
    from: fromStr,
    to: normalizeRecipients(to),
    cc: normalizeRecipients(cc || []),
    subject,
    html: finalHtmlBody,
    text: finalTextBody,
    attachments,
    replyTo: account.address,
  });

  if (!result.ok) {
    return jsonResponse({ error: 'Failed to forward', details: result.error }, 500);
  }

  // Store forwarded email in sent
  const fwdId = crypto.randomUUID();
  const r2Key = `sent/${ctx.session.accountId}/${fwdId}.json`;
  await env.MAIL_STORE.put(r2Key, JSON.stringify({ from: fromStr, to, subject, htmlBody: finalHtmlBody }));

  await env.DB.prepare(`
    INSERT INTO emails (
      id, account_id, message_id, from_address, from_name, to_address,
      subject, snippet, text_body, html_body, r2_key,
      folder, is_read, is_parsed, date
    ) VALUES (
      ?1, ?2, ?3, ?4, ?5, ?6,
      ?7, ?8, ?9, ?10, ?11,
      'sent', 1, 1, datetime('now')
    )
  `).bind(
    fwdId, ctx.session.accountId, result.messageId || `<${fwdId}@${env.DOMAIN}>`,
    account.address, account.display_name || '', JSON.stringify(normalizeRecipients(to)),
    subject, (finalTextBody || '').slice(0, 200),
    finalTextBody.slice(0, 65536), finalHtmlBody.slice(0, 65536), r2Key,
  ).run();

  return jsonResponse({ ok: true, emailId: fwdId });
}

// ── Drafts ──────────────────────────────────────────────────

async function saveDraft(request, env, ctx) {
  const body = await request.json();
  const { to, cc, bcc, subject, htmlBody, textBody } = body;

  const account = await env.DB.prepare(
    'SELECT address, display_name FROM accounts WHERE id = ?'
  ).bind(ctx.session.accountId).first();

  const draftId = crypto.randomUUID();

  await env.DB.prepare(`
    INSERT INTO emails (
      id, account_id, from_address, from_name, to_address, cc_address, bcc_address,
      subject, snippet, text_body, html_body,
      folder, is_draft, is_read, is_parsed, date
    ) VALUES (
      ?1, ?2, ?3, ?4, ?5, ?6, ?7,
      ?8, ?9, ?10, ?11,
      'drafts', 1, 1, 1, datetime('now')
    )
  `).bind(
    draftId, ctx.session.accountId,
    account.address, account.display_name || '',
    JSON.stringify(normalizeRecipients(to || [])),
    JSON.stringify(normalizeRecipients(cc || [])),
    JSON.stringify(normalizeRecipients(bcc || [])),
    subject || '', (textBody || '').slice(0, 200),
    (textBody || '').slice(0, 65536), (htmlBody || '').slice(0, 65536),
  ).run();

  return jsonResponse({ ok: true, draftId }, 201);
}

async function updateDraft(request, env, ctx) {
  const draftId = pathSegment(request.url, 2);
  const body = await request.json();
  const { to, cc, bcc, subject, htmlBody, textBody } = body;

  const existing = await env.DB.prepare(
    'SELECT id FROM emails WHERE id = ? AND account_id = ? AND is_draft = 1'
  ).bind(draftId, ctx.session.accountId).first();
  if (!existing) return jsonResponse({ error: 'Draft not found' }, 404);

  await env.DB.prepare(`
    UPDATE emails SET
      to_address = ?1, cc_address = ?2, bcc_address = ?3,
      subject = ?4, snippet = ?5, text_body = ?6, html_body = ?7,
      updated_at = datetime('now')
    WHERE id = ?8
  `).bind(
    JSON.stringify(normalizeRecipients(to || [])),
    JSON.stringify(normalizeRecipients(cc || [])),
    JSON.stringify(normalizeRecipients(bcc || [])),
    subject || '', (textBody || '').slice(0, 200),
    (textBody || '').slice(0, 65536), (htmlBody || '').slice(0, 65536),
    draftId,
  ).run();

  return jsonResponse({ ok: true });
}

async function deleteDraft(request, env, ctx) {
  const draftId = pathSegment(request.url, 2);

  const existing = await env.DB.prepare(
    'SELECT id FROM emails WHERE id = ? AND account_id = ? AND is_draft = 1'
  ).bind(draftId, ctx.session.accountId).first();
  if (!existing) return jsonResponse({ error: 'Draft not found' }, 404);

  await env.DB.prepare('DELETE FROM emails WHERE id = ?').bind(draftId).run();
  return jsonResponse({ ok: true });
}

// ── Resend Integration ──────────────────────────────────────

async function sendViaResend(env, email) {
  try {
    const payload = {
      from: email.from,
      to: email.to,
      subject: email.subject,
    };

    if (email.cc?.length > 0) payload.cc = email.cc;
    if (email.bcc?.length > 0) payload.bcc = email.bcc;
    if (email.html) payload.html = email.html;
    if (email.text) payload.text = email.text;
    if (email.replyTo) payload.reply_to = email.replyTo;
    if (email.headers) payload.headers = email.headers;
    if (email.attachments?.length > 0) payload.attachments = email.attachments;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Resend error:', data);
      return { ok: false, error: data };
    }

    return { ok: true, messageId: data.id };
  } catch (err) {
    console.error('Resend fetch error:', err);
    return { ok: false, error: err.message };
  }
}

// ── Helpers ─────────────────────────────────────────────────

function normalizeRecipients(recipients) {
  if (!recipients) return [];
  return (Array.isArray(recipients) ? recipients : [recipients]).map(r => {
    if (typeof r === 'string') return r.toLowerCase().trim();
    return r.address ? r.address.toLowerCase().trim() : r;
  }).filter(Boolean);
}

function safeParse(str) {
  try { return JSON.parse(str || '[]'); } catch { return []; }
}

function escapeHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function upsertContact(env, accountId, address, name) {
  if (!address) return;
  await env.DB.prepare(`
    INSERT INTO contacts (id, account_id, address, name, last_seen, frequency)
    VALUES (?1, ?2, ?3, ?4, datetime('now'), 1)
    ON CONFLICT(account_id, address)
    DO UPDATE SET last_seen = datetime('now'), frequency = contacts.frequency + 1
  `).bind(crypto.randomUUID(), accountId, address.toLowerCase(), name || '').run();
}

async function resolveAttachments(env, attachmentIds) {
  if (!attachmentIds || attachmentIds.length === 0) return [];

  const attachments = [];
  for (const attId of attachmentIds) {
    const att = await env.DB.prepare(
      'SELECT filename, content_type, r2_key FROM attachments WHERE id = ?'
    ).bind(attId).first();
    if (att) {
      const obj = await env.MAIL_STORE.get(att.r2_key);
      if (obj) {
        const content = await obj.arrayBuffer();
        attachments.push({
          filename: att.filename,
          content: arrayBufferToBase64(content),
          content_type: att.content_type,
        });
      }
    }
  }
  return attachments;
}
