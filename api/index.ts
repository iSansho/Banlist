import express from "express";
import path from "path";
import axios from "axios";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Middleware to check admin status
const requireAdmin = async (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Unauthorized" });

  const token = authHeader.split(" ")[1];
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) return res.status(401).json({ error: "Unauthorized" });

  const providerId = user.user_metadata?.provider_id || user.id;
  
  const { data: adminData } = await supabase
    .from("admins")
    .select("*")
    .eq("discord_id", providerId)
    .single();

  const whitelist = process.env.VITE_ADMIN_WHITELIST?.split(",") || [];
  const isWhitelisted = whitelist.includes(providerId);

  if (!adminData && !isWhitelisted) {
    return res.status(403).json({ error: "Forbidden: Admins only" });
  }

  req.user = user;
  next();
};

// Health check
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    env: {
      hasBotToken: !!process.env.DISCORD_BOT_TOKEN,
      hasGuildId: !!process.env.DISCORD_GUILD_ID,
      nodeEnv: process.env.NODE_ENV,
      isVercel: !!process.env.VERCEL
    }
  });
});

// API for Discord Webhook
app.post("/api/webhook", requireAdmin, async (req, res) => {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return res.status(500).json({ error: "Webhook URL not configured" });

  try {
    await axios.post(webhookUrl, req.body);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// API for Discord Members
app.get("/api/discord/members", requireAdmin, async (req, res) => {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!botToken || !guildId) {
    return res.status(500).json({ error: "Discord Bot Token or Guild ID not configured" });
  }

  try {
    let allMembers: any[] = [];
    let lastId = "0";
    let hasMore = true;
    let iterations = 0;

    while (hasMore && iterations < 5) {
      const response = await axios.get(`https://discord.com/api/v10/guilds/${guildId}/members?limit=1000&after=${lastId}`, {
        headers: { Authorization: `Bot ${botToken}` }
      });

      const members = response.data;
      if (members.length === 0) {
        hasMore = false;
      } else {
        allMembers = [...allMembers, ...members];
        lastId = members[members.length - 1].user.id;
        if (members.length < 1000) hasMore = false;
      }
      iterations++;
    }

    const mappedMembers = allMembers.map((m: any) => ({
      id: m.user.id,
      username: m.user.username,
      global_name: m.user.global_name,
      avatar: m.user.avatar
    }));

    res.json(mappedMembers);
  } catch (error: any) {
    console.error("Discord API error:", error.response?.data || error.message);
    res.status(500).json({ 
      error: error.message,
      discordResponse: error.response?.data 
    });
  }
});

async function setupVite() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
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
}

if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
  setupVite().then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
  });
}

export default app;
