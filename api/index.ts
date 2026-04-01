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
  if (!authHeader) return res.status(401).json({ error: "Chýba autorizácia" });

  const token = authHeader.split(" ")[1];
  
  // Overíme token priamo cez Supabase
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) return res.status(401).json({ error: "Neplatný token" });

  // Získame ID (provider_id pre Discord, alebo id pre Email)
  const providerId = user.user_metadata?.provider_id || user.id;
  const userEmail = user.email;

  // 1. Kontrola Superadmina podľa emailu
  if (userEmail === 'Floutic@gmail.com') {
    req.user = { ...user, rank: 1 };
    return next();
  }

  // 2. Kontrola v DB podľa ID (pre Discord užívateľov)
  const { data: adminData } = await supabase
    .from("admins")
    .select("*")
    .eq("discord_id", providerId)
    .maybeSingle();

  if (adminData) {
    req.user = { ...user, rank: adminData.rank || 3 };
    return next();
  }

  return res.status(403).json({ error: "Prístup zamietnutý: Nie ste admin" });
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
// api/index.ts - časť pre členov
app.get("/api/discord/members", requireAdmin, async (req, res) => {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!botToken || !guildId) {
    return res.status(500).json({ error: "Chýba Bot Token alebo Guild ID v nastaveniach Vercelu." });
  }

  try {
    // Načítame prvých 1000 členov (pre väčšinu serverov stačí)
    const response = await axios.get(`https://discord.com/api/v10/guilds/${guildId}/members?limit=1000`, {
      headers: { Authorization: `Bot ${botToken}` }
    });

    const mappedMembers = response.data.map((m: any) => ({
      id: m.user.id,
      username: m.user.username,
      global_name: m.user.global_name || m.user.username,
      avatar: m.user.avatar
    }));

    res.json(mappedMembers);
  } catch (error: any) {
    console.error("Discord API Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Nepodarilo sa načítať členov z Discordu. Skontrolujte Bot Token a Intents." });
  }
});

// API for Suggestions Import
app.post("/api/suggestions/import", requireAdmin, async (req, res) => {
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Neplatné správy" });
  }

  try {
    const firstMsg = messages[0];
    const { data: suggestion, error: suggestionError } = await supabase
      .from("bugs")
      .insert([{
        title: firstMsg.title || "Importovaný návrh",
        description: firstMsg.content,
        reporter_name: firstMsg.author_name,
        type: "SUGGESTION",
        status: "OPEN",
        priority: "MEDIUM"
      }])
      .select()
      .single();

    if (suggestionError) throw suggestionError;

    if (messages.length > 1) {
      const comments = messages.slice(1).map(m => ({
        suggestion_id: suggestion.id,
        author_name: m.author_name,
        content: m.content
      }));

      const { error: commentsError } = await supabase
        .from("suggestion_comments")
        .insert(comments);

      if (commentsError) throw commentsError;
    }

    res.json({ success: true, id: suggestion.id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
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
