import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { ENV } from './config';
import { handleInteraction } from './handlers/interactionHandler';
import { handleMessageCreate } from './handlers/messageHandler';
import { setupRealtimeListener } from './handlers/realtimeHandler';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel],
});

client.once('ready', () => {
  console.log(`Logged in as ${client.user?.tag}!`);
  
  // Spustenie počúvania na Supabase Realtime
  setupRealtimeListener(client);
});

client.on('interactionCreate', async (interaction) => {
  await handleInteraction(interaction);
});

client.on('messageCreate', async (message) => {
  await handleMessageCreate(message);
});

// Zachytenie neočakávaných chýb, aby bot nespadol
process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

client.login(ENV.DISCORD_TOKEN);
