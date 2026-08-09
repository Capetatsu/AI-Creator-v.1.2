// planner.js
// Turns a natural-language prompt into a structured agent configuration:
//   { name, domain, tone, audience, frequencyMinutes, contentStyle }
//
// Uses the same AI_API_URL / AI_API_KEY / AI_MODEL env vars as writer.js
// when a key is configured. If no key is set, falls back to a
// deterministic keyword parser so this feature works with zero setup —
// same fallback philosophy as writer.js's mockWrite().

const AI_API_URL = process.env.AI_API_URL || "https://api.groq.com/openai/v1/chat/completions";
const AI_API_KEY = process.env.AI_API_KEY || "";
const AI_MODEL = process.env.AI_MODEL || "llama-3.1-8b-instant";

const DEFAULTS = {
  name: "Content Agent",
  domain: "AI and technology news",
  tone: "informative and concise",
  audience: "general audience",
  frequencyMinutes: 10,
  contentStyle: "concise",
};

/**
 * Interprets a natural-language prompt into an agent configuration.
 * @param {string} prompt
 * @returns {Promise<{name:string, domain:string, tone:string, audience:string, frequencyMinutes:number, contentStyle:string}>}
 */
async function planPersona(prompt) {
  let config;

  if (AI_API_KEY) {
    try {
      config = await planWithAI(prompt);
    } catch (err) {
      console.error("[PLANNER] AI planning failed, using fallback parser:", err.message);
      config = planWithFallback(prompt);
    }
  } else {
    config = planWithFallback(prompt);
  }

  // Final override: if the user's own words state a frequency explicitly,
  // that always wins over whatever the AI model or the fallback regex
  // came up with. This is what prevents bugs like "every 1 minute"
  // silently turning into 1440 (a day) — no matter which path produced
  // the config above, a clearly-stated frequency in the prompt itself
  // is authoritative.
  const explicitFrequency = parseExplicitFrequency(prompt);
  if (explicitFrequency !== null) {
    config = { ...config, frequencyMinutes: explicitFrequency };
  }

  return config;
}

/**
 * Parses an explicit frequency directly out of the raw prompt text, if one
 * is stated. Returns a whole number of minutes, or null if no explicit
 * frequency phrase is present (in which case callers should fall back to
 * whatever the AI/keyword path produced, or DEFAULTS.frequencyMinutes).
 *
 * Rules: minutes stay minutes, hours are ×60, days are ×1440. Recognizes:
 *   every N minute(s)   -> N
 *   every N hour(s)     -> N * 60
 *   every hour          -> 60
 *   every N day(s)      -> N * 1440
 *   every day / daily   -> 1440
 */
function parseExplicitFrequency(prompt) {
  const lower = String(prompt || "").toLowerCase();

  const minuteMatch = lower.match(/every\s+(\d+)\s*min(?:ute)?s?\b/);
  if (minuteMatch) return Number(minuteMatch[1]);

  const hourMatch = lower.match(/every\s+(\d+)\s*hours?\b/);
  if (hourMatch) return Number(hourMatch[1]) * 60;

  if (/every\s+(?:an?\s+)?hour\b/.test(lower)) return 60;

  const dayMatch = lower.match(/every\s+(\d+)\s*days?\b/);
  if (dayMatch) return Number(dayMatch[1]) * 1440;

  if (/every\s+day\b/.test(lower) || /\bdaily\b/.test(lower)) return 1440;

  return null;
}

/**
 * Uses the configured OpenAI-compatible chat API to interpret the prompt.
 */
async function planWithAI(prompt) {
  const systemPrompt = `You turn a user's natural-language request into a JSON object describing an autonomous content-posting agent.

Return ONLY valid JSON with exactly these fields, and nothing else (no markdown fences, no explanation):
{
  "name": string,
  "domain": string,
  "tone": string,
  "audience": string,
  "frequencyMinutes": number,
  "contentStyle": string
}

If a field can't be determined from the prompt, use a sensible default.`;

  const res = await fetch(AI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    throw new Error(`AI API returned ${res.status}`);
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content || "";
  const parsed = JSON.parse(extractJson(raw));

  return normalizeConfig(parsed);
}

/**
 * Pulls a JSON object out of the model's raw text response, tolerating
 * markdown code fences even though the prompt asks the model not to use them.
 */
function extractJson(raw) {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const text = fenced ? fenced[1] : raw;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("No JSON object found in AI response");
  }
  return text.slice(start, end + 1);
}

/**
 * Deterministic keyword-based parser. No API key required.
 * Recognizes: frequency ("every 30 minutes" / "every 2 hours"),
 * a handful of common domains, tone words, content-style words, and
 * an audience phrase ("for <audience>").
 */
function planWithFallback(prompt) {
  const lower = prompt.toLowerCase();

  // --- frequency ---
  const parsedFrequency = parseExplicitFrequency(prompt);
  const frequencyMinutes = parsedFrequency !== null ? parsedFrequency : DEFAULTS.frequencyMinutes;

  // --- domain ---
  let domain = DEFAULTS.domain;
  if (/\bai\b/.test(lower) || lower.includes("artificial intelligence")) {
    domain = "AI news";
  }
  if (lower.includes("crypto")) domain = "cryptocurrency news";
  if (lower.includes("startup")) domain = "startup news";
  if (lower.includes("sport")) domain = "sports news";
  if (lower.includes("science")) domain = "science news";
  if (lower.includes("security")) domain = "security news";

  // --- tone ---
  const toneWords = [];
  if (/funny|humor|humour|witty|joke/.test(lower)) toneWords.push("humorous");
  if (/informative|informational/.test(lower)) toneWords.push("informative");
  if (/serious/.test(lower)) toneWords.push("serious");
  if (/casual/.test(lower)) toneWords.push("casual");
  const tone = toneWords.length > 0 ? toneWords.join(" and ") : DEFAULTS.tone;

  // --- content style ---
  let contentStyle = DEFAULTS.contentStyle;
  if (/concise|brief|short/.test(lower)) contentStyle = "concise";
  if (/detailed|in-depth|long/.test(lower)) contentStyle = "detailed";

  // --- audience: "for <audience>" ---
  let audience = DEFAULTS.audience;
  const audienceMatch = prompt.match(/\bfor\s+([a-zA-Z\s]+?)(?:\.|$)/i);
  if (audienceMatch) {
    audience = audienceMatch[1].trim();
  }

  const name = deriveName(domain);

  return normalizeConfig({ name, domain, tone, audience, frequencyMinutes, contentStyle });
}

/**
 * Builds a readable agent name from its domain, e.g. "AI news" -> "AI News Agent".
 * Keeps short existing-uppercase words (like "AI") as-is instead of lowercasing them.
 */
function deriveName(domain) {
  const words = domain
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      if (word === word.toUpperCase() && word.length <= 4) return word;
      return word[0].toUpperCase() + word.slice(1).toLowerCase();
    });
  return `${words.join(" ")} Agent`;
}

/**
 * Fills in any missing/invalid fields with defaults so downstream code
 * (writer.js, backend init, etc.) always receives a complete, valid shape.
 */
function normalizeConfig(config) {
  const frequencyMinutes = Number(config.frequencyMinutes);
  return {
    name: (config.name || DEFAULTS.name).toString().trim(),
    domain: (config.domain || DEFAULTS.domain).toString().trim(),
    tone: (config.tone || DEFAULTS.tone).toString().trim(),
    audience: (config.audience || DEFAULTS.audience).toString().trim(),
    frequencyMinutes: frequencyMinutes > 0 ? frequencyMinutes : DEFAULTS.frequencyMinutes,
    contentStyle: (config.contentStyle || DEFAULTS.contentStyle).toString().trim(),
  };
}

module.exports = { planPersona, parseExplicitFrequency };
