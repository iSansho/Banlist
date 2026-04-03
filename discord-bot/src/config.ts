import { config } from 'dotenv';
config();

export const ENV = {
  DISCORD_TOKEN: process.env.DISCORD_TOKEN!,
  DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID!,
  DISCORD_GUILD_ID: process.env.DISCORD_GUILD_ID!,
  DISCORD_BUG_CHANNEL_ID: process.env.DISCORD_BUG_CHANNEL_ID!,
  DISCORD_SUGGESTION_CHANNEL_ID: process.env.DISCORD_SUGGESTION_CHANNEL_ID!,
  SUPABASE_URL: process.env.SUPABASE_URL!,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
};

// Validate env vars
for (const [key, value] of Object.entries(ENV)) {
  if (!value) {
    console.error(`Missing environment variable: ${key}`);
    process.exit(1);
  }
}
