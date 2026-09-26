// ============================================================
// Crypto Utilities — Password hashing & JWT tokens
// Uses Web Crypto API (available in Workers runtime)
// ============================================================

const PBKDF2_ITERATIONS = 100_000;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;

// ── Password Hashing (PBKDF2-SHA256) ────────────────────────
// We use PBKDF2 because Workers runtime supports it natively.
// Format stored: `pbkdf2:iterations:salt_hex:hash_hex`

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    KEY_LENGTH * 8
  );
  const hash = new Uint8Array(bits);
  return `pbkdf2:${PBKDF2_ITERATIONS}:${hex(salt)}:${hex(hash)}`;
}

export async function verifyPassword(password, stored) {
  const [, iterStr, saltHex, hashHex] = stored.split(':');
  const iterations = parseInt(iterStr, 10);
  const salt = unhex(saltHex);
  const expectedHash = unhex(hashHex);

  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    KEY_LENGTH * 8
  );
  const actualHash = new Uint8Array(bits);
  return timingSafeEqual(actualHash, expectedHash);
}

// ── JWT Tokens ──────────────────────────────────────────────
// Simple HMAC-SHA256 JWT implementation (no external deps)

export async function createToken(payload, secret, expiresInHours = 24 * 7) {
  if (!secret || typeof secret !== 'string' || secret.length < 16) {
    throw new Error('JWT_SECRET secret is missing or insecure (must be at least 16 characters)');
  }

  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    ...payload,
    iat: now,
    exp: now + expiresInHours * 3600,
    jti: crypto.randomUUID(),
  };

  const encodedHeader  = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(claims));
  const data = `${encodedHeader}.${encodedPayload}`;

  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  const encodedSig = base64url(sig);

  return { token: `${data}.${encodedSig}`, jti: claims.jti, expiresAt: new Date(claims.exp * 1000).toISOString() };
}

export async function verifyToken(token, secret) {
  if (!secret || typeof secret !== 'string') return null;
  const parts = (token || '').split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, encodedSig] = parts;
  const data = `${encodedHeader}.${encodedPayload}`;

  try {
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );

    const sig = base64urlDecode(encodedSig);
    const valid = await crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(data));
    if (!valid) return null;

    const jsonStr = new TextDecoder().decode(base64urlDecode(encodedPayload));
    const payload = JSON.parse(jsonStr);
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}

// ── Helpers ─────────────────────────────────────────────────

function hex(buffer) {
  return Array.from(new Uint8Array(buffer instanceof ArrayBuffer ? buffer : buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function unhex(hexStr) {
  const bytes = new Uint8Array(hexStr.length / 2);
  for (let i = 0; i < hexStr.length; i += 2) {
    bytes[i / 2] = parseInt(hexStr.substr(i, 2), 16);
  }
  return bytes;
}

function base64url(input) {
  const bytes = typeof input === 'string'
    ? new TextEncoder().encode(input)
    : new Uint8Array(input instanceof ArrayBuffer ? input : input);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}
