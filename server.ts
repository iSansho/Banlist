import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API for Discord Webhook (to keep URL secret)
  app.post("/api/webhook", async (req, res) => {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
      return res.status(500).json({ error: "Webhook URL not configured" });
    }

    try {
      await axios.post(webhookUrl, req.body);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Webhook error:", error.response?.data || error.message);
      res.status(500).json({ error: "Failed to send webhook" });
    }
  });

  // API for Discord Members
  app.get("/api/discord/members", async (req, res) => {
    const botToken = process.env.DISCORD_BOT_TOKEN;
    const guildId = process.env.DISCORD_GUILD_ID;

    if (!botToken || !guildId) {
      return res.status(500).json({ error: "Discord Bot Token or Guild ID not configured" });
    }

    try {
      // Discord API limits members fetch to 1000 per request. 
      // For larger servers, pagination would be needed.
      const response = await axios.get(`https://discord.com/api/v10/guilds/${guildId}/members?limit=1000`, {
        headers: {
          Authorization: `Bot ${botToken}`
        }
      });

      const members = response.data.map((m: any) => ({
        id: m.user.id,
        username: m.user.username,
        global_name: m.user.global_name,
        avatar: m.user.avatar,
        discriminator: m.user.discriminator
      }));

      res.json(members);
    } catch (error: any) {
      console.error("Discord API error:", error.response?.data || error.message);
      res.status(500).json({ error: "Failed to fetch Discord members" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
