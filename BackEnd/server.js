import "dotenv/config";
import express from "express";
import morgan from "morgan";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { AnalyzeReviewTool } from "./tools.js";

const PORT = parseInt(process.env.PORT || "2300", 10);

function getServer() {
  const server = new McpServer({
    name: "GitHub Review Assistant",
    version: "1.0.0",
    instructions: "Stateless: rewrite tone and add extra suggestions from the provided code snippet."
  });

  server.tool(
    AnalyzeReviewTool.name,
    AnalyzeReviewTool.desc,
    AnalyzeReviewTool.schema,
    async (req) => {
      console.log("tool.invoke payload keys:", Object.keys(req || {}));
      console.log("tool.invoke payload:", JSON.stringify(req, null, 2));
      
      const parsed = AnalyzeReviewTool.schema;
      const result = await AnalyzeReviewTool.handler(parsed);
      
      return {
        status: 200, // HTTP 200 OK
        content: [{ type: "text", text: JSON.stringify(result) }]
      };
    }
  );

  return server;
}


const app = express();
app.use(morgan("dev"));
app.use(express.json());

// Track SSE transports by session
const transports = Object.create(null);

/** Establish SSE stream for MCP */
app.get("/mcp", async (_req, res) => {
  try {
    const transport = new SSEServerTransport("/messages", res);
    const sessionId = transport.sessionId;
    transports[sessionId] = transport;

    transport.onclose = () => { delete transports[sessionId]; };

    const server = getServer();
    await server.connect(transport);

    console.log(`✅ SSE session established: ${sessionId}`);
    console.log(`→ POST JSON-RPC to: http://localhost:${PORT}/messages?sessionId=${sessionId}`);
  } catch (err) {
    console.error("Error establishing SSE:", err);
    if (!res.headersSent) res.status(500).send("Error establishing SSE stream");
  }
});

/** Receive JSON-RPC messages */
app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId;
  if (!sessionId) return res.status(400).send("Missing sessionId parameter");
  const transport = transports[sessionId];
  if (!transport) return res.status(404).send("Session not found");
  console.log(sessionId);
  try {
    await transport.handlePostMessage(req, res, req.body);
  } catch (err) {
    console.error("Error handling request:", err);
    if (!res.headersSent) res.status(500).send("Error handling request");
  }
});

app.get("/", (_req, res) => {
  res.type("text/plain").send(
`MCP server running.

1) Open /mcp in your browser to establish an SSE session.
2) Copy the sessionId printed in the server logs.
3) POST JSON-RPC to /messages?sessionId=YOUR_ID (use Postman).`
  );
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down...");
  for (const sid of Object.keys(transports)) {
    try { await transports[sid].close(); } catch {}
    delete transports[sid];
  }
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`Server: http://localhost:${PORT}/`);
});
