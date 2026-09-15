-- ============================================================
-- PBG Mail — D1 Schema
-- Multi-user serverless mailbox system
-- ============================================================

-- Accounts: each represents a distinct @pbgofficials.dev mailbox
CREATE TABLE IF NOT EXISTS accounts (
  id          TEXT PRIMARY KEY,              -- UUID
  address     TEXT UNIQUE NOT NULL,          -- e.g. support@pbgofficials.dev
  display_name TEXT NOT NULL DEFAULT '',     -- e.g. "PBG Support"
  password_hash TEXT NOT NULL,              -- argon2id hash
  role        TEXT NOT NULL DEFAULT 'user',  -- 'admin' | 'user'
  is_active   INTEGER NOT NULL DEFAULT 1,
  storage_used INTEGER NOT NULL DEFAULT 0,  -- bytes across R2
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Sessions: JWT-backed, stored for revocation
CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,              -- token jti
  account_id  TEXT NOT NULL,
  user_agent  TEXT DEFAULT '',
  ip_address  TEXT DEFAULT '',
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

-- Threads: groups related emails (conversation view)
CREATE TABLE IF NOT EXISTS threads (
  id          TEXT PRIMARY KEY,              -- UUID
  account_id  TEXT NOT NULL,
  subject     TEXT NOT NULL DEFAULT '',      -- normalised (stripped Re:/Fwd:)
  last_date   TEXT NOT NULL DEFAULT (datetime('now')),
  message_count INTEGER NOT NULL DEFAULT 0,
  unread_count INTEGER NOT NULL DEFAULT 0,
  snippet     TEXT DEFAULT '',               -- preview text
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

-- Emails: one row per inbound/outbound/draft message
CREATE TABLE IF NOT EXISTS emails (
  id          TEXT PRIMARY KEY,              -- UUID
  account_id  TEXT NOT NULL,
  thread_id   TEXT,                          -- NULL until threaded
  message_id  TEXT,                          -- RFC 2822 Message-ID
  in_reply_to TEXT,                          -- for threading
  "references" TEXT,                         -- space-delimited Message-IDs

  -- Envelope
  from_address TEXT NOT NULL,
  from_name   TEXT DEFAULT '',
  to_address  TEXT NOT NULL DEFAULT '',      -- JSON array
  cc_address  TEXT DEFAULT '[]',             -- JSON array
  bcc_address TEXT DEFAULT '[]',             -- JSON array
  reply_to    TEXT DEFAULT '',

  -- Content
  subject     TEXT NOT NULL DEFAULT '(no subject)',
  snippet     TEXT DEFAULT '',               -- first ~200 chars of text body
  text_body   TEXT DEFAULT '',               -- plain text (stored if < 64KB)
  html_body   TEXT DEFAULT '',               -- HTML (stored if < 64KB)
  body_r2_key TEXT DEFAULT '',               -- fallback: large bodies stored in R2

  -- Storage
  r2_key      TEXT NOT NULL DEFAULT '',      -- raw .eml path in R2
  size_bytes  INTEGER NOT NULL DEFAULT 0,    -- total message size

  -- State
  folder      TEXT NOT NULL DEFAULT 'inbox', -- inbox|sent|drafts|trash|spam|archive
  is_read     INTEGER NOT NULL DEFAULT 0,
  is_starred  INTEGER NOT NULL DEFAULT 0,
  is_draft    INTEGER NOT NULL DEFAULT 0,
  has_attachments INTEGER NOT NULL DEFAULT 0,

  -- Processing state (for queue)
  is_parsed   INTEGER NOT NULL DEFAULT 0,    -- 0=raw only, 1=fully parsed

  -- Timestamps
  date        TEXT NOT NULL DEFAULT (datetime('now')), -- email Date header
  received_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE SET NULL
);

-- Attachments: metadata pointers into R2
CREATE TABLE IF NOT EXISTS attachments (
  id          TEXT PRIMARY KEY,              -- UUID
  email_id    TEXT NOT NULL,
  filename    TEXT NOT NULL DEFAULT 'unnamed',
  content_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  size_bytes  INTEGER NOT NULL DEFAULT 0,
  r2_key      TEXT NOT NULL,                 -- path in R2
  content_id  TEXT DEFAULT '',               -- for inline images (cid:)
  is_inline   INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE
);

-- Contacts: auto-populated from sent/received
CREATE TABLE IF NOT EXISTS contacts (
  id          TEXT PRIMARY KEY,
  account_id  TEXT NOT NULL,
  address     TEXT NOT NULL,
  name        TEXT DEFAULT '',
  last_seen   TEXT NOT NULL DEFAULT (datetime('now')),
  frequency   INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  UNIQUE(account_id, address)
);

-- ============================================================
-- Indexes
-- ============================================================

-- Fast mailbox listing sorted by date
CREATE INDEX IF NOT EXISTS idx_emails_folder
  ON emails(account_id, folder, date DESC);

-- Unread counts
CREATE INDEX IF NOT EXISTS idx_emails_unread
  ON emails(account_id, folder, is_read)
  WHERE is_read = 0;

-- Thread lookup
CREATE INDEX IF NOT EXISTS idx_emails_thread
  ON emails(thread_id, date ASC);

-- Message-ID dedup + threading lookups
CREATE INDEX IF NOT EXISTS idx_emails_message_id
  ON emails(message_id);

CREATE INDEX IF NOT EXISTS idx_emails_in_reply_to
  ON emails(in_reply_to);

-- Unparsed emails (queue consumer picks these up)
CREATE INDEX IF NOT EXISTS idx_emails_unparsed
  ON emails(is_parsed)
  WHERE is_parsed = 0;

-- Session expiry cleanup
CREATE INDEX IF NOT EXISTS idx_sessions_expiry
  ON sessions(expires_at);

-- Session lookup by account
CREATE INDEX IF NOT EXISTS idx_sessions_account
  ON sessions(account_id);

-- Thread ordering
CREATE INDEX IF NOT EXISTS idx_threads_date
  ON threads(account_id, last_date DESC);

-- Contact autocomplete
CREATE INDEX IF NOT EXISTS idx_contacts_address
  ON contacts(account_id, address);

CREATE INDEX IF NOT EXISTS idx_contacts_freq
  ON contacts(account_id, frequency DESC);
