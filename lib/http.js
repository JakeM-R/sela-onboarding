import { AgentError, LIMITS, makeClient } from "./agent.js";

const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...extra },
  });

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Wraps an agent step as a POST handler. Identical inputs are served from the
// Cloudflare edge cache for a week, so the demo candidates load instantly and
// a repeat click costs nothing.
export function handler(name, run) {
  return async ({ request, env, waitUntil }) => {
    if (request.method !== "POST") return json({ error: "POST only" }, 405);
    if (!env.ANTHROPIC_API_KEY) return json({ error: "ANTHROPIC_API_KEY is not set on this deployment." }, 500);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Body must be JSON." }, 400);
    }
    if (typeof body.jd === "string" && body.jd.length > LIMITS.jd) return json({ error: `Job description is over ${LIMITS.jd} characters.` }, 413);
    if (typeof body.candidate === "string" && body.candidate.length > LIMITS.candidate) return json({ error: `Candidate text is over ${LIMITS.candidate} characters.` }, 413);

    const key = new Request(`https://cache.internal/${name}/${await sha256(JSON.stringify(body))}`);
    const cache = typeof caches !== "undefined" ? caches.default : null;
    if (cache) {
      const hit = await cache.match(key);
      if (hit) return new Response(hit.body, { headers: { ...Object.fromEntries(hit.headers), "x-cache": "hit" } });
    }

    try {
      const started = Date.now();
      const result = await run(makeClient(env.ANTHROPIC_API_KEY, env.ANTHROPIC_BASE_URL), body);
      const res = json({ ...result, seconds: Math.round((Date.now() - started) / 100) / 10 }, 200, {
        "cache-control": "public, max-age=604800",
      });
      if (cache) waitUntil(cache.put(key, res.clone()));
      return res;
    } catch (err) {
      const status = err instanceof AgentError ? err.status : err?.status >= 400 ? 502 : 500;
      return json({ error: err?.message || "Unexpected error." }, status);
    }
  };
}

export function requireFields(body, fields) {
  for (const f of fields) {
    if (body[f] === undefined || body[f] === null || body[f] === "") throw new AgentError(`Missing field: ${f}`, 400);
  }
}
