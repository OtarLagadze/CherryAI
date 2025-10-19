chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message?.type === "ANALYZE_REVIEW") {
        const { comment, code, filePath, language, stylePreset } = message.payload || {};
        const result = await analyzeReview({ comment, code, filePath, language, stylePreset });
        sendResponse(result);
        return;
      }

      if (message?.type === "IMPROVE_COMMENT") {
        const { text, context } = message.payload || {};
        const improvedText = mockImprove(text, context);
        sendResponse({ rewritten: improvedText, suggestions: [], improvedText });
        return;
      }

      sendResponse({ error: "Unknown message type" });
    } catch (e) {
      sendResponse({ error: e?.message || "Unhandled error" });
    }
  })();

  return true;
});

async function analyzeReview(args) {
  const cfg = await getConfig();
  const base = (cfg.BASE_URL || "").replace(/\/$/, "");

  if (!base) {
    const improved = mockImprove(args.comment, { surface: "unknown" });
    return { rewritten: improved, suggestions: [] };
  }

  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 18000);

    const res = await fetch(`${base}/analyze_review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        comment: String(args.comment || ""),
        code: String(args.code || ""),
        filePath: String(args.filePath || "unknown"),
        language: String(args.language || "auto"),
        stylePreset: String(args.stylePreset || "friendly")
      }),
      signal: controller.signal
    });

    clearTimeout(t);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Backend error ${res.status}: ${text}`);
    }

    const data = await res.json().catch(() => ({}));
    if (typeof data?.rewritten === "string") return data;

    return { rewritten: mockImprove(args.comment, { surface: "unknown" }), suggestions: [] };
  } catch {
    return { rewritten: mockImprove(args.comment, { surface: "unknown" }), suggestions: [] };
  }
}

function mockImprove(text, context) {
  const trimmed = (text || "").trim();
  if (!trimmed) return "";
  const prefix = context?.surface === "review" ? "Review suggestion:\n" : "Suggested comment:\n";
  const polished = trimmed.replace(/\s+/g, " ").replace(/(^\w)/, (m) => m.toUpperCase());
  return `${prefix}${polished}\n\n— AI (local mock)`;
}

function getConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["BASE_URL", "API_KEY"], (res) => {
      resolve({ BASE_URL: res.BASE_URL || "", API_KEY: res.API_KEY || "" });
    });
  });
}
