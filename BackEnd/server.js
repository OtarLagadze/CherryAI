import express from "express";
import cors from "cors";
import { AnalyzeReviewTool } from "./tools.js";
import { runLLM } from "./llm.js";

const app = express();
const PORT = process.env.PORT || 2300;

app.use(cors({ origin: "*" }));
app.use(express.json());

app.post("/analyze_review", async (req, res) => {
  try {
    const args = req.body;

    if (!args.comment || !args.code) {
      return res.status(400).json({ error: "Missing 'comment' or 'code' in body." });
    }

    const result = await AnalyzeReviewTool.handler(args);

    res.json(result);
  } catch (err) {
    console.error("Error in analyze_review:", err);
    res.status(500).json({ error: err.message || "Internal error" });
  }
});

app.get("/", (_req, res) => res.send("MCP AnalyzeReview backend running."));

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
