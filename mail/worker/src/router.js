// ============================================================
// API Router — dispatches HTTP requests to handlers
// ============================================================

import { handleAuth }        from './api/auth.js';
import { handleEmails }      from './api/emails.js';
import { handleCompose }     from './api/compose.js';
import { handleAttachments } from './api/attachments.js';
import { handleAccounts }    from './api/accounts.js';
import { authenticate }      from './middleware/auth.js';

export async function handleRequest(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // ── CORS preflight ────────────────────────────────────────
  if (method === 'OPTIONS') {
    return corsResponse(new Response(null, { status: 204 }), env);
  }

  try {
    let response;

    // ── Public routes (no auth) ─────────────────────────────
    if (path === '/api/auth/login' && method === 'POST') {
      response = await handleAuth(request, env, 'login');
    } else if (path === '/api/auth/setup' && method === 'POST') {
      response = await handleAuth(request, env, 'setup');
    }

    // ── Static assets fallback ─────────────────────────────
    else if (!path.startsWith('/api/')) {
      if (env.ASSETS) {
        return env.ASSETS.fetch(request);
      }
      response = new Response('Not Found', { status: 404 });
    }

    // ── Protected routes ────────────────────────────────────
    else {
      const session = await authenticate(request, env);
      if (!session) {
        return corsResponse(jsonResponse({ error: 'Unauthorized' }, 401), env);
      }

      // Attach session to request context
      const ctx = { session, env, url };

      // Auth routes
      if (path === '/api/auth/logout' && method === 'POST') {
        response = await handleAuth(request, env, 'logout', ctx);
      } else if (path === '/api/auth/me' && method === 'GET') {
        response = await handleAuth(request, env, 'me', ctx);
      }

      // Email routes
      else if (path === '/api/emails' && method === 'GET') {
        response = await handleEmails(request, env, 'list', ctx);
      } else if (path === '/api/emails/search' && method === 'GET') {
        response = await handleEmails(request, env, 'search', ctx);
      } else if (path === '/api/emails/counts' && method === 'GET') {
        response = await handleEmails(request, env, 'counts', ctx);
      } else if (path.match(/^\/api\/emails\/[^/]+$/) && method === 'GET') {
        response = await handleEmails(request, env, 'get', ctx);
      } else if (path.match(/^\/api\/emails\/[^/]+$/) && method === 'PATCH') {
        response = await handleEmails(request, env, 'update', ctx);
      } else if (path.match(/^\/api\/emails\/[^/]+$/) && method === 'DELETE') {
        response = await handleEmails(request, env, 'delete', ctx);
      } else if (path === '/api/emails/batch' && method === 'POST') {
        response = await handleEmails(request, env, 'batch', ctx);
      }

      // Compose routes
      else if (path === '/api/compose/send' && method === 'POST') {
        response = await handleCompose(request, env, 'send', ctx);
      } else if (path === '/api/compose/reply' && method === 'POST') {
        response = await handleCompose(request, env, 'reply', ctx);
      } else if (path === '/api/compose/forward' && method === 'POST') {
        response = await handleCompose(request, env, 'forward', ctx);
      } else if (path === '/api/drafts' && method === 'POST') {
        response = await handleCompose(request, env, 'saveDraft', ctx);
      } else if (path.match(/^\/api\/drafts\/[^/]+$/) && method === 'PUT') {
        response = await handleCompose(request, env, 'updateDraft', ctx);
      } else if (path.match(/^\/api\/drafts\/[^/]+$/) && method === 'DELETE') {
        response = await handleCompose(request, env, 'deleteDraft', ctx);
      }

      // Attachment routes
      else if (path.match(/^\/api\/emails\/[^/]+\/attachments$/) && method === 'GET') {
        response = await handleAttachments(request, env, 'list', ctx);
      } else if (path.match(/^\/api\/emails\/[^/]+\/attachments\/[^/]+$/) && method === 'GET') {
        response = await handleAttachments(request, env, 'download', ctx);
      } else if (path === '/api/attachments/upload' && method === 'POST') {
        response = await handleAttachments(request, env, 'upload', ctx);
      }

      // Account management (admin only)
      else if (path === '/api/accounts' && method === 'GET') {
        response = await handleAccounts(request, env, 'list', ctx);
      } else if (path === '/api/accounts' && method === 'POST') {
        response = await handleAccounts(request, env, 'create', ctx);
      } else if (path.match(/^\/api\/accounts\/[^/]+$/) && method === 'PATCH') {
        response = await handleAccounts(request, env, 'update', ctx);
      } else if (path.match(/^\/api\/accounts\/[^/]+$/) && method === 'DELETE') {
        response = await handleAccounts(request, env, 'delete', ctx);
      }

      // Contact routes
      else if (path === '/api/contacts' && method === 'GET') {
        response = await handleEmails(request, env, 'contacts', ctx);
      }

      else {
        response = jsonResponse({ error: 'Not found' }, 404);
      }
    }

    return corsResponse(response, env);

  } catch (err) {
    console.error('Router error:', err);
    return corsResponse(
      jsonResponse({ error: 'Internal server error', message: err.message }, 500),
      env
    );
  }
}

// ── Helpers ─────────────────────────────────────────────────

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function corsResponse(response, env) {
  const origin = env.WEBMAIL_ORIGIN || '*';
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  headers.set('Access-Control-Allow-Credentials', 'true');
  headers.set('Access-Control-Max-Age', '86400');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/** Extract a path segment by index from a URL pathname */
export function pathSegment(url, index) {
  const parts = new URL(url).pathname.split('/').filter(Boolean);
  return parts[index] || null;
}
