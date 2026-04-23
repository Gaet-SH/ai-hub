require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ─── Claude (Anthropic) ───────────────────────────────────────────────────────
app.post("/api/claude", async (req, res) => {
  const { messages, model = "claude-opus-4-5" } = req.body;
  try {
    const Anthropic = require("@anthropic-ai/sdk");
    const client = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Stream response
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const stream = await client.messages.stream({
      model,
      max_tokens: 2048,
      messages,
    });

    for await (const chunk of stream) {
      if (
        chunk.type === "content_block_delta" &&
        chunk.delta.type === "text_delta"
      ) {
        res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`);
      }
    }
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    console.error("Claude error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GPT (OpenAI) ─────────────────────────────────────────────────────────────
app.post("/api/gpt", async (req, res) => {
  const { messages, model = "gpt-4o" } = req.body;
  try {
    const OpenAI = require("openai");
    const client = new OpenAI.default({ apiKey: process.env.OPENAI_API_KEY });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const stream = await client.chat.completions.create({
      model,
      messages,
      stream: true,
      max_tokens: 2048,
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || "";
      if (text) {
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    console.error("GPT error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Gemini (Google) ──────────────────────────────────────────────────────────
app.post("/api/gemini", async (req, res) => {
  const { messages, model = "gemini-1.5-pro" } = req.body;
  try {
    const { GoogleGenerativeAI } = require("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    const geminiModel = genAI.getGenerativeModel({ model });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Convert messages format for Gemini
    const history = messages.slice(0, -1).map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
    const lastMessage = messages[messages.length - 1].content;

    const chat = geminiModel.startChat({ history });
    const result = await chat.sendMessageStream(lastMessage);

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    console.error("Gemini error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({
    claude: !!process.env.ANTHROPIC_API_KEY,
    gpt: !!process.env.OPENAI_API_KEY,
    gemini: !!process.env.GOOGLE_API_KEY,
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 AI Hub lancé sur http://localhost:${PORT}\n`);
  console.log(
    `  Claude  : ${process.env.ANTHROPIC_API_KEY ? "✅ configuré" : "❌ clé manquante"}`
  );
  console.log(
    `  GPT     : ${process.env.OPENAI_API_KEY ? "✅ configuré" : "❌ clé manquante"}`
  );
  console.log(
    `  Gemini  : ${process.env.GOOGLE_API_KEY ? "✅ configuré" : "❌ clé manquante"}\n`
  );
});
