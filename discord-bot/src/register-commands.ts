import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import { ENV } from './config';

const commands = [
  new SlashCommandBuilder()
    .setName('report')
    .setDescription('Nahlásiť chybu (Bug) v hre'),
  new SlashCommandBuilder()
    .setName('suggest')
    .setDescription('Podať návrh na vylepšenie (Suggestion)')
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(ENV.DISCORD_TOKEN);

(async () => {
  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(
      Routes.applicationGuildCommands(ENV.DISCORD_CLIENT_ID, ENV.DISCORD_GUILD_ID),
      { body: commands },
    );

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
})();
