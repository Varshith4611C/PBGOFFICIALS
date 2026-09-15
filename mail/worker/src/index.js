// ============================================================
// PBG Mail — Worker Entry Point
// Handles: email(), fetch(), queue()
// ============================================================

import { handleEmail }   from './email-handler.js';
import { handleQueue }   from './queue-consumer.js';
import { handleRequest } from './router.js';

export default {
  /**
   * Inbound email handler — called by Cloudflare Email Routing.
   * MUST be lightweight (< 10 ms CPU on free tier).
   * Stores raw .eml in R2, enqueues for async MIME parsing.
   */
  async email(message, env, ctx) {
    await handleEmail(message, env, ctx);
  },

  /**
   * HTTP fetch handler — serves the REST API for the webmail frontend.
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) {
      if (env.ASSETS) {
        return env.ASSETS.fetch(request);
      }
    }
    return handleRequest(request, env, ctx);
  },

  /**
   * Queue consumer — processes inbound emails asynchronously.
   * Has generous CPU budget (up to 15s per message on free tier).
   * Parses MIME, extracts body/attachments, populates D1.
   */
  async queue(batch, env, ctx) {
    for (const msg of batch.messages) {
      try {
        await handleQueue(msg, env, ctx);
        msg.ack();
      } catch (err) {
        console.error(`Queue processing failed for ${msg.id}:`, err);
        msg.retry();
      }
    }
  },
};
