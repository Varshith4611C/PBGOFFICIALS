// ============================================================
// Emails API — List, Get, Update, Delete, Search, Batch, Counts
// All queries scoped to ctx.session.accountId (mailbox isolation)
// ============================================================

import { jsonResponse, pathSegment } from '../router.js';
import PostalMime from 'postal-mime';

const PAGE_SIZE = 50;

export async function handleEmails(request, env, action, ctx) {
  switch (action) {
    case 'list':     return listEmails(request, env, ctx);
    case 'get':      return getEmail(request, env, ctx);
    case 'update':   return updateEmail(request, env, ctx);
    case 'delete':   return deleteEmail(request, env, ctx);
    case 'search':   return searchEmails(request, env, ctx);
    case 'batch':    return batchAction(request, env, ctx);
    case 'counts':   return folderCounts(request, env, ctx);
    case 'contacts': return listContacts(request, env, ctx);
    default:         return jsonResponse({ error: 'Unknown action' }, 400);
  }
}

// ── List Emails ─────────────────────────────────────────────

async function listEmails(request, env, ctx) {
  const url = new URL(request.url);
  const folder = url.searchParams.get('folder') || 'inbox';
  const page   = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const offset = (page - 1) * PAGE_SIZE;
  const threadView = url.searchParams.get('threads') === 'true';

  if (threadView && folder === 'inbox') {
    return listThreads(env, ctx, page, offset);
  }

  const emails = await env.DB.prepare(`
    SELECT id, message_id, from_address, from_name, to_address, cc_address,
           subject, snippet, folder, is_read, is_starred, is_draft,
           has_attachments, date, received_at, thread_id, is_parsed
    FROM emails
    WHERE account_id = ?1 AND folder = ?2 AND is_draft = 0
    ORDER BY date DESC
    LIMIT ?3 OFFSET ?4
  `).bind(ctx.session.accountId, folder, PAGE_SIZE, offset).all();

  const total = await env.DB.prepare(
    'SELECT COUNT(*) as count FROM emails WHERE account_id = ? AND folder = ? AND is_draft = 0'
  ).bind(ctx.session.accountId, folder).first();

  return jsonResponse({
    emails: emails.results.map(formatEmailSummary),
    page,
    pageSize: PAGE_SIZE,
    total: total.count,
    totalPages: Math.ceil(total.count / PAGE_SIZE),
  });
}

// ── Thread View ─────────────────────────────────────────────

async function listThreads(env, ctx, page, offset) {
  const threads = await env.DB.prepare(`
    SELECT t.id, t.subject, t.last_date, t.message_count, t.unread_count, t.snippet,
           (SELECT from_name || ' <' || from_address || '>' FROM emails
            WHERE thread_id = t.id ORDER BY date DESC LIMIT 1) as last_sender
    FROM threads t
    WHERE t.account_id = ?1
    ORDER BY t.last_date DESC
    LIMIT ?2 OFFSET ?3
  `).bind(ctx.session.accountId, PAGE_SIZE, offset).all();

  const total = await env.DB.prepare(
    'SELECT COUNT(*) as count FROM threads WHERE account_id = ?'
  ).bind(ctx.session.accountId).first();

  return jsonResponse({
    threads: threads.results,
    page,
    pageSize: PAGE_SIZE,
    total: total.count,
    totalPages: Math.ceil(total.count / PAGE_SIZE),
  });
}

// ── Get Single Email ────────────────────────────────────────

async function getEmail(request, env, ctx) {
  const emailId = pathSegment(request.url, 2); // /api/emails/:id

  const email = await env.DB.prepare(`
    SELECT * FROM emails WHERE id = ? AND account_id = ?
  `).bind(emailId, ctx.session.accountId).first();

  if (!email) return jsonResponse({ error: 'Email not found' }, 404);

  // If not yet parsed, try lazy parse from R2
  if (!email.is_parsed && email.r2_key) {
    const parsed = await lazyParse(env, email);
    if (parsed) {
      Object.assign(email, parsed);
    }
  }

  // If body was stored in R2 (too large for D1), fetch it
  if (email.body_r2_key && (!email.html_body && !email.text_body)) {
    const bodyObj = await env.MAIL_STORE.get(email.body_r2_key);
    if (bodyObj) {
      const body = await bodyObj.json();
      email.text_body = body.text || '';
      email.html_body = body.html || '';
    }
  }

  // Mark as read
  if (!email.is_read) {
    await env.DB.prepare(
      "UPDATE emails SET is_read = 1, updated_at = datetime('now') WHERE id = ?"
    ).bind(emailId).run();

    // Update thread unread count
    if (email.thread_id) {
      await env.DB.prepare(
        'UPDATE threads SET unread_count = MAX(0, unread_count - 1) WHERE id = ?'
      ).bind(email.thread_id).run();
    }
  }

  // Fetch attachments
  const attachments = await env.DB.prepare(
    'SELECT id, filename, content_type, size_bytes, is_inline, content_id FROM attachments WHERE email_id = ?'
  ).bind(emailId).all();

  // Fetch thread siblings
  let thread = [];
  if (email.thread_id) {
    const siblings = await env.DB.prepare(`
      SELECT id, from_address, from_name, subject, snippet, date, is_read
      FROM emails
      WHERE thread_id = ? AND account_id = ?
      ORDER BY date ASC
    `).bind(email.thread_id, ctx.session.accountId).all();
    thread = siblings.results;
  }

  return jsonResponse({
    email: formatEmailFull(email),
    attachments: attachments.results,
    thread,
  });
}

// ── Update Email (read/star/folder) ─────────────────────────

async function updateEmail(request, env, ctx) {
  const emailId = pathSegment(request.url, 2);
  const body = await request.json();
  const { is_read, is_starred, folder } = body;

  // Verify ownership
  const email = await env.DB.prepare(
    'SELECT id, thread_id, is_read, folder FROM emails WHERE id = ? AND account_id = ?'
  ).bind(emailId, ctx.session.accountId).first();
  if (!email) return jsonResponse({ error: 'Email not found' }, 404);

  const updates = [];
  const values = [];
  let paramIdx = 1;

  if (is_read !== undefined) {
    updates.push(`is_read = ?${paramIdx}`);
    values.push(is_read ? 1 : 0);
    paramIdx++;

    // Update thread unread count
    if (email.thread_id) {
      const delta = is_read ? -1 : 1;
      await env.DB.prepare(
        `UPDATE threads SET unread_count = MAX(0, unread_count + ${delta}) WHERE id = ?`
      ).bind(email.thread_id).run();
    }
  }
  if (is_starred !== undefined) {
    updates.push(`is_starred = ?${paramIdx}`);
    values.push(is_starred ? 1 : 0);
    paramIdx++;
  }
  if (folder !== undefined) {
    const validFolders = ['inbox', 'sent', 'trash', 'spam', 'archive', 'drafts'];
    if (!validFolders.includes(folder)) {
      return jsonResponse({ error: 'Invalid folder' }, 400);
    }
    updates.push(`folder = ?${paramIdx}`);
    values.push(folder);
    paramIdx++;
  }

  if (updates.length === 0) {
    return jsonResponse({ error: 'No updates provided' }, 400);
  }

  updates.push(`updated_at = datetime('now')`);
  values.push(emailId, ctx.session.accountId);

  await env.DB.prepare(
    `UPDATE emails SET ${updates.join(', ')} WHERE id = ?${paramIdx} AND account_id = ?${paramIdx + 1}`
  ).bind(...values).run();

  return jsonResponse({ ok: true });
}

// ── Delete Email ────────────────────────────────────────────

async function deleteEmail(request, env, ctx) {
  const emailId = pathSegment(request.url, 2);
  const url = new URL(request.url);
  const permanent = url.searchParams.get('permanent') === 'true';

  const email = await env.DB.prepare(
    'SELECT id, folder, r2_key, thread_id FROM emails WHERE id = ? AND account_id = ?'
  ).bind(emailId, ctx.session.accountId).first();
  if (!email) return jsonResponse({ error: 'Email not found' }, 404);

  if (permanent || email.folder === 'trash') {
    // Permanent delete: remove from D1 + R2
    const attachments = await env.DB.prepare(
      'SELECT r2_key FROM attachments WHERE email_id = ?'
    ).bind(emailId).all();

    // Delete from R2
    const r2Keys = [email.r2_key, ...attachments.results.map(a => a.r2_key)].filter(Boolean);
    for (const key of r2Keys) {
      await env.MAIL_STORE.delete(key);
    }

    // Delete from D1
    await env.DB.prepare('DELETE FROM attachments WHERE email_id = ?').bind(emailId).run();
    await env.DB.prepare('DELETE FROM emails WHERE id = ?').bind(emailId).run();

    // Clean up empty thread
    if (email.thread_id) {
      const remaining = await env.DB.prepare(
        'SELECT COUNT(*) as count FROM emails WHERE thread_id = ?'
      ).bind(email.thread_id).first();
      if (remaining.count === 0) {
        await env.DB.prepare('DELETE FROM threads WHERE id = ?').bind(email.thread_id).run();
      }
    }

    return jsonResponse({ ok: true, deleted: true });
  } else {
    // Soft delete: move to trash
    await env.DB.prepare(
      "UPDATE emails SET folder = 'trash', updated_at = datetime('now') WHERE id = ?"
    ).bind(emailId).run();
    return jsonResponse({ ok: true, trashed: true });
  }
}

// ── Batch Actions ───────────────────────────────────────────

async function batchAction(request, env, ctx) {
  const body = await request.json();
  const { ids, action: batchOp, folder: targetFolder } = body;

  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 100) {
    return jsonResponse({ error: 'Provide 1-100 email IDs' }, 400);
  }

  const placeholders = ids.map((_, i) => `?${i + 3}`).join(',');
  const accountId = ctx.session.accountId;

  switch (batchOp) {
    case 'read':
      await env.DB.prepare(
        `UPDATE emails SET is_read = 1, updated_at = datetime('now') WHERE account_id = ?1 AND id IN (${placeholders})`
      ).bind(accountId, ...ids).run();
      break;

    case 'unread':
      await env.DB.prepare(
        `UPDATE emails SET is_read = 0, updated_at = datetime('now') WHERE account_id = ?1 AND id IN (${placeholders})`
      ).bind(accountId, ...ids).run();
      break;

    case 'trash':
      await env.DB.prepare(
        `UPDATE emails SET folder = 'trash', updated_at = datetime('now') WHERE account_id = ?1 AND id IN (${placeholders})`
      ).bind(accountId, ...ids).run();
      break;

    case 'spam':
      await env.DB.prepare(
        `UPDATE emails SET folder = 'spam', updated_at = datetime('now') WHERE account_id = ?1 AND id IN (${placeholders})`
      ).bind(accountId, ...ids).run();
      break;

    case 'move':
      if (!targetFolder) return jsonResponse({ error: 'Target folder required' }, 400);
      await env.DB.prepare(
        `UPDATE emails SET folder = ?2, updated_at = datetime('now') WHERE account_id = ?1 AND id IN (${placeholders})`
      ).bind(accountId, targetFolder, ...ids).run();
      break;

    case 'star':
      await env.DB.prepare(
        `UPDATE emails SET is_starred = 1, updated_at = datetime('now') WHERE account_id = ?1 AND id IN (${placeholders})`
      ).bind(accountId, ...ids).run();
      break;

    case 'unstar':
      await env.DB.prepare(
        `UPDATE emails SET is_starred = 0, updated_at = datetime('now') WHERE account_id = ?1 AND id IN (${placeholders})`
      ).bind(accountId, ...ids).run();
      break;

    default:
      return jsonResponse({ error: 'Invalid batch action' }, 400);
  }

  return jsonResponse({ ok: true, affected: ids.length });
}

// ── Search ──────────────────────────────────────────────────

async function searchEmails(request, env, ctx) {
  const url = new URL(request.url);
  const q      = url.searchParams.get('q') || '';
  const folder = url.searchParams.get('folder') || null;
  const page   = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const offset = (page - 1) * PAGE_SIZE;

  if (q.length < 2) {
    return jsonResponse({ error: 'Query must be at least 2 characters' }, 400);
  }

  const pattern = `%${q}%`;
  let whereClause = 'account_id = ?1 AND (subject LIKE ?2 OR from_address LIKE ?2 OR from_name LIKE ?2 OR snippet LIKE ?2 OR text_body LIKE ?2)';
  const binds = [ctx.session.accountId, pattern];

  if (folder) {
    whereClause += ' AND folder = ?3';
    binds.push(folder);
  }

  const emails = await env.DB.prepare(`
    SELECT id, from_address, from_name, to_address, subject, snippet,
           folder, is_read, is_starred, has_attachments, date
    FROM emails
    WHERE ${whereClause}
    ORDER BY date DESC
    LIMIT ?${binds.length + 1} OFFSET ?${binds.length + 2}
  `).bind(...binds, PAGE_SIZE, offset).all();

  return jsonResponse({
    emails: emails.results.map(formatEmailSummary),
    query: q,
    page,
  });
}

// ── Folder Counts ───────────────────────────────────────────

async function folderCounts(request, env, ctx) {
  const counts = await env.DB.prepare(`
    SELECT
      folder,
      COUNT(*) as total,
      SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread
    FROM emails
    WHERE account_id = ? AND is_draft = 0
    GROUP BY folder
  `).bind(ctx.session.accountId).all();

  const draftsCount = await env.DB.prepare(
    'SELECT COUNT(*) as count FROM emails WHERE account_id = ? AND is_draft = 1'
  ).bind(ctx.session.accountId).first();

  const result = {};
  for (const row of counts.results) {
    result[row.folder] = { total: row.total, unread: row.unread };
  }
  result.drafts = { total: draftsCount.count, unread: 0 };

  return jsonResponse(result);
}

// ── Contacts ────────────────────────────────────────────────

async function listContacts(request, env, ctx) {
  const url = new URL(request.url);
  const q = url.searchParams.get('q') || '';

  let query, binds;
  if (q) {
    query = `
      SELECT address, name, frequency FROM contacts
      WHERE account_id = ?1 AND (address LIKE ?2 OR name LIKE ?2)
      ORDER BY frequency DESC LIMIT 20
    `;
    binds = [ctx.session.accountId, `%${q}%`];
  } else {
    query = `
      SELECT address, name, frequency FROM contacts
      WHERE account_id = ?1
      ORDER BY frequency DESC LIMIT 50
    `;
    binds = [ctx.session.accountId];
  }

  const contacts = await env.DB.prepare(query).bind(...binds).all();
  return jsonResponse({ contacts: contacts.results });
}

// ── Lazy MIME Parse (for unparsed emails viewed on-demand) ──

async function lazyParse(env, email) {
  try {
    const r2Obj = await env.MAIL_STORE.get(email.r2_key);
    if (!r2Obj) return null;

    const rawBuffer = await r2Obj.arrayBuffer();
    const parser = new PostalMime();
    const parsed = await parser.parse(rawBuffer);

    const textBody = parsed.text || '';
    const htmlBody = parsed.html || '';
    const snippet = (textBody || htmlBody.replace(/<[^>]+>/g, ' ')).slice(0, 200).trim();

    // Update D1 with parsed data
    await env.DB.prepare(`
      UPDATE emails SET
        text_body = ?1,
        html_body = ?2,
        snippet = ?3,
        to_address = ?4,
        cc_address = ?5,
        has_attachments = ?6,
        is_parsed = 1,
        updated_at = datetime('now')
      WHERE id = ?7
    `).bind(
      textBody.length < 65536 ? textBody : textBody.slice(0, 1000),
      htmlBody.length < 65536 ? htmlBody : '',
      snippet,
      JSON.stringify(formatAddressList(parsed.to)),
      JSON.stringify(formatAddressList(parsed.cc)),
      (parsed.attachments?.length || 0) > 0 ? 1 : 0,
      email.id
    ).run();

    return { text_body: textBody, html_body: htmlBody, snippet };
  } catch (err) {
    console.error('Lazy parse failed:', err);
    return null;
  }
}

function formatAddressList(addrs) {
  if (!addrs) return [];
  return (Array.isArray(addrs) ? addrs : [addrs]).map(a => ({
    name: a.name || '', address: (a.address || '').toLowerCase(),
  }));
}

// ── Response Formatters ─────────────────────────────────────

function formatEmailSummary(e) {
  return {
    id: e.id,
    from: { address: e.from_address, name: e.from_name },
    to: safeParse(e.to_address),
    cc: safeParse(e.cc_address),
    subject: e.subject,
    snippet: e.snippet,
    folder: e.folder,
    isRead: !!e.is_read,
    isStarred: !!e.is_starred,
    isDraft: !!e.is_draft,
    hasAttachments: !!e.has_attachments,
    date: e.date,
    threadId: e.thread_id,
  };
}

function formatEmailFull(e) {
  return {
    ...formatEmailSummary(e),
    textBody: e.text_body,
    htmlBody: e.html_body,
    messageId: e.message_id,
    inReplyTo: e.in_reply_to,
    references: e.references,
    replyTo: e.reply_to,
    bcc: safeParse(e.bcc_address),
    receivedAt: e.received_at,
    sizeBytes: e.size_bytes,
    isParsed: !!e.is_parsed,
  };
}

function safeParse(jsonStr) {
  try { return JSON.parse(jsonStr || '[]'); }
  catch { return []; }
}
