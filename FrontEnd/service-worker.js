// service-worker.js

// Use storage.sync for BASE_URL/API_KEY that the user sets in Options.
// If not set, we silently return a mocked "improvement".

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message?.type === "IMPROVE_COMMENT") {
        const { text, context } = message.payload || {};
        const improvedText = await improveComment(text, context);
        sendResponse({ improvedText });
        return;
      }
      sendResponse({ error: "Unknown message type" });
    } catch (e) {
      sendResponse({ error: e?.message || "Unhandled error" });
    }
  })();

  // Indicate async response
  return true;
});

async function improveComment(text, context) {
  const cfg = await getConfig();
  // If BASE_URL is missing, return a mocked improvement.
  if (!cfg.BASE_URL) {
    return mockImprove(text, context);
  }
  // Otherwise call the real endpoint (still “stubbed” here structurally).
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(`${cfg.BASE_URL.replace(/\/$/, "")}/v1/improveComment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cfg.API_KEY ? { "Authorization": `Bearer ${cfg.API_KEY}` } : {})
      },
      body: JSON.stringify({ text, context }),
      signal: controller.signal
    });
    clearTimeout(t);

    if (!res.ok) {
      // One simple retry with backoff
      await delay(400);
      return await retryOnce(cfg, text, context);
    }

    const data = await res.json().catch(() => ({}));
    return data.improvedText || mockImprove(text, context);
  } catch (err) {
    // Network/timeout → return mock to keep UX flowing
    return mockImprove(text, context);
  }
}

async function retryOnce(cfg, text, context) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 12000);
  const res = await fetch(`${cfg.BASE_URL.replace(/\/$/, "")}/v1/improveComment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cfg.API_KEY ? { "Authorization": `Bearer ${cfg.API_KEY}` } : {})
    },
    body: JSON.stringify({ text, context }),
    signal: controller.signal
  });
  clearTimeout(t);

  if (!res.ok) throw new Error("Backend error");
  const data = await res.json().catch(() => ({}));
  return data.improvedText || mockImprove(text, context);
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function mockImprove(text, context) {
  // Extremely lightweight heuristic “improvement” — replace with your AI agent later.
  const trimmed = (text || "").trim();
  if (!trimmed) return "";
  const prefix = context?.surface === "review" ? "Review suggestion:\n" : "Suggested comment:\n";
  // Basic polish: ensure sentence-case, add clarity where likely missing.
  const polished = trimmed
    .replace(/\s+/g, " ")
    .replace(/(^\w)/, (m) => m.toUpperCase());

  return `${prefix}${polished}\n\n— Improved by AI (stub)`;
}

function getConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["BASE_URL", "API_KEY"], (res) => {
      resolve({
        BASE_URL: res.BASE_URL || "",
        API_KEY: res.API_KEY || ""
      });
    });
  });
}
