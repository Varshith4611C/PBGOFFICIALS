// ============================================================
// Queue Consumer — Async MIME Processing
// Runs with generous CPU budget (15s+ per message).
// Parses the raw .eml from R2, extracts:
//   - Full To/CC/BCC headers
//   - Plain text & HTML bodies
//   - Attachments → stored individually in R2
//   - Thread linking via In-Reply-To / References
//   - Contact auto-population
// Then updates the D1 row to is_parsed = 1.
// ============================================================

import PostalMime from 'postal-mime';

const SNIPPET_LENGTH = 200;
const INLINE_BODY_MAX = 64 * 1024; // 64 KB — larger bodies go to R2

export async function handleQueue(msg, env, ctx) {
  const { emailId, accountId, r2Key } = msg.body;

  // ── 1. Fetch raw .eml from R2 ─────────────────────────────
  const r2Obj = await env.MAIL_STORE.get(r2Key);
  if (!r2Obj) {
    console.error(`R2 object not found: ${r2Key}`);
    return; // ack (don't retry — data is gone)
  }

  const rawBuffer = await r2Obj.arrayBuffer();

  // ── 2. Parse MIME ─────────────────────────────────────────
  const parser = new PostalMime();
  const parsed = await parser.parse(rawBuffer);

  // ── 3. Extract addresses ──────────────────────────────────
  const toList  = formatAddressList(parsed.to);
  const ccList  = formatAddressList(parsed.cc);
  const bccList = formatAddressList(parsed.bcc);
  const replyTo = parsed.replyTo?.[0]?.address || '';

  // ── 4. Process body ───────────────────────────────────────
  const textBody = parsed.text || '';
  const htmlBody = parsed.html || '';
  const snippet  = (textBody || stripHtml(htmlBody)).slice(0, SNIPPET_LENGTH).trim();

  // If bodies are too large, store in R2 and clear the D1 column
  let bodyR2Key = '';
  let storedText = textBody;
  let storedHtml = htmlBody;

  if (textBody.length > INLINE_BODY_MAX || htmlBody.length > INLINE_BODY_MAX) {
    bodyR2Key = `bodies/${accountId}/${emailId}.json`;
    await env.MAIL_STORE.put(bodyR2Key, JSON.stringify({ text: textBody, html: htmlBody }), {
      httpMetadata: { contentType: 'application/json' },
    });
    storedText = textBody.slice(0, 1000); // keep a preview
    storedHtml = '';
  }

  // ── 5. Process attachments ────────────────────────────────
  const hasAttachments = (parsed.attachments?.length || 0) > 0;
  const attachmentRows = [];

  for (const att of (parsed.attachments || [])) {
    const attId = crypto.randomUUID();
    const attR2Key = `attachments/${accountId}/${emailId}/${attId}-${sanitizeFilename(att.filename || 'unnamed')}`;

    await env.MAIL_STORE.put(attR2Key, att.content, {
      httpMetadata: { contentType: att.mimeType || 'application/octet-stream' },
      customMetadata: { emailId, filename: att.filename || 'unnamed' },
    });

    attachmentRows.push({
      id: attId,
      email_id: emailId,
      filename: att.filename || 'unnamed',
      content_type: att.mimeType || 'application/octet-stream',
      size_bytes: att.content?.byteLength || 0,
      r2_key: attR2Key,
      content_id: att.contentId || '',
      is_inline: att.disposition === 'inline' ? 1 : 0,
    });
  }

  // ── 6. Thread linking ─────────────────────────────────────
  const threadId = await resolveThread(env, emailId, accountId, parsed);

  // ── 7. Update the email row ───────────────────────────────
  await env.DB.prepare(`
    UPDATE emails SET
      to_address = ?1,
      cc_address = ?2,
      bcc_address = ?3,
      reply_to = ?4,
      snippet = ?5,
      text_body = ?6,
      html_body = ?7,
      body_r2_key = ?8,
      has_attachments = ?9,
      thread_id = ?10,
      is_parsed = 1,
      updated_at = datetime('now')
    WHERE id = ?11
  `).bind(
    JSON.stringify(toList),
    JSON.stringify(ccList),
    JSON.stringify(bccList),
    replyTo,
    snippet,
    storedText,
    storedHtml,
    bodyR2Key,
    hasAttachments ? 1 : 0,
    threadId,
    emailId
  ).run();

  // ── 8. Insert attachment rows ─────────────────────────────
  for (const att of attachmentRows) {
    await env.DB.prepare(`
      INSERT INTO attachments (id, email_id, filename, content_type, size_bytes, r2_key, content_id, is_inline)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
    `).bind(att.id, att.email_id, att.filename, att.content_type, att.size_bytes, att.r2_key, att.content_id, att.is_inline).run();
  }

  // ── 9. Update account storage usage ───────────────────────
  const totalAttSize = attachmentRows.reduce((s, a) => s + a.size_bytes, 0);
  await env.DB.prepare(
    'UPDATE accounts SET storage_used = storage_used + ?1 WHERE id = ?2'
  ).bind((rawBuffer.byteLength + totalAttSize), accountId).run();

  // ── 10. Auto-populate contacts ────────────────────────────
  await upsertContact(env, accountId, parsed.from?.address, parsed.from?.name);
}

// ============================================================
// Thread Resolution
// ============================================================

async function resolveThread(env, emailId, accountId, parsed) {
  const subject = parsed.subject || '';
  const inReplyTo = parsed.inReplyTo || '';
  const references = parsed.references || '';
  const normalSubject = normalizeSubject(subject);

  // Try to find an existing thread via In-Reply-To
  if (inReplyTo) {
    const parent = await env.DB.prepare(
      'SELECT thread_id FROM emails WHERE message_id = ? AND account_id = ? AND thread_id IS NOT NULL'
    ).bind(inReplyTo, accountId).first();

    if (parent?.thread_id) {
      await updateThread(env, parent.thread_id, normalSubject);
      return parent.thread_id;
    }
  }

  // Try via References (last one is most relevant)
  if (references) {
    const refList = references.split(/\s+/).filter(Boolean);
    for (let i = refList.length - 1; i >= 0; i--) {
      const ref = await env.DB.prepare(
        'SELECT thread_id FROM emails WHERE message_id = ? AND account_id = ? AND thread_id IS NOT NULL'
      ).bind(refList[i], accountId).first();

      if (ref?.thread_id) {
        await updateThread(env, ref.thread_id, normalSubject);
        return ref.thread_id;
      }
    }
  }

  // Try subject-based threading (same normalised subject within 7 days)
  const subjectThread = await env.DB.prepare(`
    SELECT id FROM threads
    WHERE account_id = ? AND subject = ?
      AND last_date > datetime('now', '-7 days')
    ORDER BY last_date DESC LIMIT 1
  `).bind(accountId, normalSubject).first();

  if (subjectThread) {
    await updateThread(env, subjectThread.id, normalSubject);
    return subjectThread.id;
  }

  // Create new thread
  const threadId = crypto.randomUUID();
  await env.DB.prepare(`
    INSERT INTO threads (id, account_id, subject, last_date, message_count, unread_count, snippet)
    VALUES (?1, ?2, ?3, datetime('now'), 1, 1, ?4)
  `).bind(
    threadId, accountId, normalSubject,
    (parsed.text || '').slice(0, SNIPPET_LENGTH)
  ).run();

  return threadId;
}

async function updateThread(env, threadId, subject) {
  await env.DB.prepare(`
    UPDATE threads SET
      last_date = datetime('now'),
      message_count = message_count + 1,
      unread_count = unread_count + 1
    WHERE id = ?
  `).bind(threadId).run();
}

// ============================================================
// Contacts
// ============================================================

async function upsertContact(env, accountId, address, name) {
  if (!address) return;
  await env.DB.prepare(`
    INSERT INTO contacts (id, account_id, address, name, last_seen, frequency)
    VALUES (?1, ?2, ?3, ?4, datetime('now'), 1)
    ON CONFLICT(account_id, address)
    DO UPDATE SET
      name = CASE WHEN excluded.name != '' THEN excluded.name ELSE contacts.name END,
      last_seen = datetime('now'),
      frequency = contacts.frequency + 1
  `).bind(crypto.randomUUID(), accountId, address.toLowerCase(), name || '').run();
}

// ============================================================
// Helpers
// ============================================================

function formatAddressList(addrs) {
  if (!addrs) return [];
  return (Array.isArray(addrs) ? addrs : [addrs]).map(a => ({
    name: a.name || '',
    address: (a.address || '').toLowerCase(),
  }));
}

function normalizeSubject(subject) {
  return subject
    .replace(/^(re|fwd?|fw)\s*:\s*/gi, '')
    .replace(/^(re|fwd?|fw)\s*:\s*/gi, '') // double strip for "Re: Re:"
    .trim()
    .toLowerCase();
}

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
}
