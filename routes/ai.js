const express = require('express');
const axios = require('axios');
const router = express.Router();

// ── PBG AI Endpoint (NVIDIA NIM Integration & Rate Limited) ──
const DEFAULT_AI_MODEL = 'meta/llama-3.2-11b-vision-instruct';
const aiRateLimits = new Map();
const AI_RATE_WINDOW_MS = 60 * 1000; // 1 minute
const AI_MAX_REQUESTS_PER_WINDOW = 25;

// Periodically prune expired rate limit records every 5 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of aiRateLimits.entries()) {
    if (now > entry.resetAt) aiRateLimits.delete(ip);
  }
}, 5 * 60 * 1000).unref();

function checkAiRateLimit(ip) {
  const now = Date.now();
  const entry = aiRateLimits.get(ip) || { count: 0, resetAt: now + AI_RATE_WINDOW_MS };
  if (now > entry.resetAt) {
    entry.count = 1;
    entry.resetAt = now + AI_RATE_WINDOW_MS;
    aiRateLimits.set(ip, entry);
    return true;
  }
  if (entry.count >= AI_MAX_REQUESTS_PER_WINDOW) {
    return false;
  }
  entry.count++;
  aiRateLimits.set(ip, entry);
  return true;
}

router.post('/chat', async (req, res) => {
  const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';
  if (!checkAiRateLimit(clientIp)) {
    return res.status(429).json({
      error: 'Rate limit exceeded. Please wait a moment before sending more messages.'
    });
  }

  let { messages, model = DEFAULT_AI_MODEL } = req.body || {};

  const apiKey = (process.env.NVIDIA_API_KEY || '').trim();

  if (!apiKey) {
    return res.status(500).json({
      error: 'AI service is temporarily unavailable. Please try again later.'
    });
  }

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Messages array is required.' });
  }

  const systemPrompt = {
    role: 'system',
    content: `You are PBG AI, the official cybernetic intelligent AI assistant for PBG Officials (https://pbgofficials.dev).
You are smart, helpful, witty, friendly, and tech-savvy.
PBG Officials is a multi-platform digital entertainment hub featuring:
- PBG Anime: Free HD anime streaming, latest trending episodes, sub & dub player (/anime/).
- PBG Manga: Fast, clean manga reading platform.
- PBG TV: Live IPTV streaming entertainment.
- PBG ChatBox: Real-time community chat rooms, synchronized 24/7 live music radio stations, anime cinema watch parties (/chatbox/).
- PBG Games & Tech: High-speed gaming experiences and digital creations.

Contact & Support:
- Official Email: support@pbgofficials.dev

Guidelines:
- Answer questions about PBG Officials platforms, features, and site navigation.
- Recommend anime, discuss characters, manga, music, gaming, tech, and code.
- Write clean code, explain concepts, and format responses cleanly with Markdown (bold, bullet points, syntax-highlighted code blocks).
- Be engaging, conversational, and concise.`
  };

  const formattedMessages = [systemPrompt, ...messages.filter(m => m && m.role !== 'system')];

  // Helper function to call NVIDIA NIM
  const callNvidia = async (selectedModel) => {
    return await axios.post(
      'https://integrate.api.nvidia.com/v1/chat/completions',
      {
        model: selectedModel,
        messages: formattedMessages,
        temperature: 0.6,
        top_p: 0.9,
        max_tokens: 1024,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        timeout: 45000,
      }
    );
  };

  try {
    let response;
    let usedModel = model || DEFAULT_AI_MODEL;

    try {
      response = await callNvidia(usedModel);
    } catch (modelErr) {
      // If requested model was sunset/deprecated (410) or not found (404), fallback to active default model
      if ((modelErr.response?.status === 410 || modelErr.response?.status === 404) && usedModel !== DEFAULT_AI_MODEL) {
        console.warn(`Model ${usedModel} returned ${modelErr.response?.status}, falling back to ${DEFAULT_AI_MODEL}`);
        usedModel = DEFAULT_AI_MODEL;
        response = await callNvidia(usedModel);
      } else {
        throw modelErr;
      }
    }

    const reply = response.data?.choices?.[0]?.message?.content || 'No response generated.';
    res.json({
      reply,
      model: usedModel,
      usage: response.data?.usage
    });
  } catch (err) {
    console.error('NVIDIA AI API error:', err.response?.data || err.message);
    const errorDetail = err.response?.data?.message || err.response?.data?.error?.message || err.response?.data?.error || err.message || 'Failed to communicate with NVIDIA AI.';
    res.status(err.response?.status || 500).json({ error: errorDetail });
  }
});

module.exports = router;
