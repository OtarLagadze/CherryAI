import { z } from "zod";
import { runLLM } from "./llm.js";

export const AnalyzeArgsSchema = z.object({
  comment: z.string().describe("Original reviewer comment text"),
  code: z.string().describe("Relevant code slice or diff hunk currently open"),
  filePath: z.string().default("unknown").describe("Path of the file in the repo"),
  language: z.string().default("auto").describe("Language hint (auto/js/ts/py/etc)"),
  stylePreset: z.enum(["friendly", "neutral", "formal"]).default("friendly")
});

export const AnalyzeReviewTool = {
  name: "analyze_review",
  desc: "Rewrite review comment with better tone and add extra suggestions (improvements/bugs) from the provided code.",
  schema: AnalyzeArgsSchema,
  handler: async (args) => {
    const system = [
      "You are a senior code-review assistant.",
      "You must return a strict JSON object with this shape:",
      "{",
      '  "rewritten": string,',
      '  "suggestions": [',
      '    { "id": string, "severity": "info"|"warn"|"error", "category": "bug"|"improvement"|"clarity"|"style"|"performance"|"testing"|"security", "message": string, "evidence": string }',
      "  ]",
      "}",
      "",
      "Guidelines:",
      "- Rewrite the user's comment to be kind, specific, and concise.",
      "- Analyze ONLY the provided code snippet.",
      "- Always suggest 3-5 actionable improvements, even minor ones:",
      "    - naming conventions",
      "    - potential optimizations",
      "    - clarity improvements",
      "    - test coverage",
      "- Each suggestion must have short evidence (line numbers or rationale)",
      "- Do NOT include code patches"    
    ].join("\n");

    const userPayload = {
      comment: args.comment,
      code: args.code,
      filePath: args.filePath,
      language: args.language,
      stylePreset: args.stylePreset
    };

    const content = await runLLM({
      system,
      user: JSON.stringify(userPayload)
    });

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      throw new Error("Model did not return valid JSON.");
    }

    if (
      typeof parsed !== "object" ||
      typeof parsed.rewritten !== "string" ||
      !Array.isArray(parsed.suggestions)
    ) {
      throw new Error("Model JSON shape invalid.");
    }

    parsed.suggestions = parsed.suggestions.map((s, i) => ({
      id: String(s?.id ?? `sug-${i + 1}`),
      severity: s?.severity === "error" || s?.severity === "warn" ? s.severity : "info",
      category: ["bug","improvement","clarity","style","performance","testing","security"].includes(s?.category) ? s.category : "improvement",
      message: String(s?.message ?? ""),
      evidence: String(s?.evidence ?? "")
    }));

    return parsed;
  }
};
