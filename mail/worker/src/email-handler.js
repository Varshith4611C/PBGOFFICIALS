// ============================================================
// Email Handler — Lightweight Inbound Receiver
// Runs inside the email() event (10 ms CPU budget on free tier).
//
// Strategy: do the absolute minimum here.
//   1. Read the raw email stream
//   2. PUT it into R2
//   3. Extract cheap header values (from, to, subject, message-id, date)
//   4. Insert a skeleton row in D1 (is_parsed = 0)
//   5. Enqueue the email ID for the queue consumer
// ============================================================

export async function handleEmail(message, env, ctx) {
  const id = crypto.randomUUID();

  // ── 1. Collect the raw bytes ──────────────────────────────
  const rawBytes = await streamToArrayBuffer(message.raw);
  const sizeBytes = rawBytes.byteLength;

  // ── 2. Determine the recipient mailbox ────────────────────
  const toAddress = (message.to || '').toLowerCase().trim();

  const account = await env.DB.prepare(
    'SELECT id FROM accounts WHERE address = ? AND is_active = 1'
  ).bind(toAddress).first();

  if (!account) {
    // Unknown mailbox — reject so sender gets a bounce
    message.setReject(`Mailbox <${toAddress}> does not exist`);
    return;
  }

  // ── 3. Store raw .eml in R2 ───────────────────────────────
  const r2Key = `raw/${account.id}/${id}.eml`;
  await env.MAIL_STORE.put(r2Key, rawBytes, {
    httpMetadata: { contentType: 'message/rfc822' },
    customMetadata: { emailId: id, accountId: account.id },
  });

  // ── 4. Extract minimal headers (zero MIME parsing) ────────
  const fromHeader   = message.from || '';
  const subject      = message.headers.get('subject') || '(no subject)';
  const messageId    = message.headers.get('message-id') || '';
  const inReplyTo    = message.headers.get('in-reply-to') || '';
  const references   = message.headers.get('references') || '';
  const dateHeader   = message.headers.get('date') || '';

  // Parse "Name <addr>" from the From header
  const fromParsed = parseAddress(fromHeader);

  // Build a minimal to-address list (just the envelope recipient for now;
  // the queue consumer will extract the full To/CC/BCC from MIME headers)
  const toList = JSON.stringify([toAddress]);

  // Try to parse the date; fall back to now
  let emailDate;
  try {
    emailDate = dateHeader ? new Date(dateHeader).toISOString() : new Date().toISOString();
  } catch {
    emailDate = new Date().toISOString();
  }

  // ── 5. Insert skeleton row in D1 ─────────────────────────
  await env.DB.prepare(`
    INSERT INTO emails (
      id, account_id, message_id, in_reply_to, "references",
      from_address, from_name, to_address,
      subject, r2_key, size_bytes, folder,
      is_parsed, date, received_at
    ) VALUES (
      ?1, ?2, ?3, ?4, ?5,
      ?6, ?7, ?8,
      ?9, ?10, ?11, 'inbox',
      0, ?12, datetime('now')
    )
  `).bind(
    id, account.id, messageId, inReplyTo, references,
    fromParsed.address, fromParsed.name, toList,
    subject, r2Key, sizeBytes,
    emailDate
  ).run();

  // ── 6. Enqueue for async processing ───────────────────────
  await env.MAIL_QUEUE.send({
    emailId:   id,
    accountId: account.id,
    r2Key:     r2Key,
  });
}

// ── Helpers ─────────────────────────────────────────────────

/** Parse "Display Name <email@example.com>" into { name, address } */
function parseAddress(raw) {
  const match = raw.match(/^(.+?)\s*<([^>]+)>$/);
  if (match) {
    return { name: match[1].replace(/^["']|["']$/g, '').trim(), address: match[2].toLowerCase() };
  }
  return { name: '', address: raw.toLowerCase().trim() };
}

/** Consume a ReadableStream into an ArrayBuffer */
async function streamToArrayBuffer(stream) {
  const reader = stream.getReader();
  const chunks = [];
  let totalLen = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    totalLen += value.byteLength;
  }
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result.buffer;
}
