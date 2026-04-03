import { 
  Interaction, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle, 
  ActionRowBuilder, 
  ForumChannel, 
  ThreadAutoArchiveDuration 
} from 'discord.js';
import { supabase } from '../supabase';
import { ENV } from '../config';

export async function handleInteraction(interaction: Interaction) {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'report') {
      const modal = new ModalBuilder()
        .setCustomId('bug_report_modal')
        .setTitle('Nahlásiť Bug');

      const titleInput = new TextInputBuilder()
        .setCustomId('title')
        .setLabel('Krátky názov chyby')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const descInput = new TextInputBuilder()
        .setCustomId('description')
        .setLabel('Podrobný popis')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      const stepsInput = new TextInputBuilder()
        .setCustomId('steps')
        .setLabel('Kroky na reprodukciu')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false);

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(descInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(stepsInput)
      );

      await interaction.showModal(modal);
    } else if (interaction.commandName === 'suggest') {
      const modal = new ModalBuilder()
        .setCustomId('suggestion_modal')
        .setTitle('Podať Návrh');

      const titleInput = new TextInputBuilder()
        .setCustomId('title')
        .setLabel('Krátky názov návrhu')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const descInput = new TextInputBuilder()
        .setCustomId('description')
        .setLabel('Podrobný popis návrhu')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(descInput)
      );

      await interaction.showModal(modal);
    }
  } else if (interaction.isModalSubmit()) {
    const isBug = interaction.customId === 'bug_report_modal';
    const isSuggestion = interaction.customId === 'suggestion_modal';

    if (!isBug && !isSuggestion) return;

    await interaction.deferReply({ ephemeral: true });

    try {
      const title = interaction.fields.getTextInputValue('title');
      const description = interaction.fields.getTextInputValue('description');
      const steps = isBug ? interaction.fields.getTextInputValue('steps') : null;

      const channelId = isBug ? ENV.DISCORD_BUG_CHANNEL_ID : ENV.DISCORD_SUGGESTION_CHANNEL_ID;
      const channel = await interaction.client.channels.fetch(channelId) as ForumChannel;

      if (!channel || !channel.isThreadOnly()) {
        throw new Error('Cieľový kanál nie je fórum.');
      }

      // Vytvorenie threadu vo fóre
      const thread = await channel.threads.create({
        name: `${isBug ? '🐛' : '💡'} ${title}`,
        autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
        message: {
          content: `**Autor:** <@${interaction.user.id}>\n**Popis:**\n${description}${steps ? `\n\n**Kroky na reprodukciu:**\n${steps}` : ''}`
        }
      });

      // Zápis do Supabase - Tabuľka tickets
      const { data: ticket, error: ticketError } = await supabase.from('tickets').insert({
        discord_thread_id: thread.id,
        type: isBug ? 'BUG' : 'SUGGESTION',
        title: title,
        description: description,
        steps_to_reproduce: steps,
        author_discord_id: interaction.user.id,
        author_name: interaction.user.username
      }).select().single();

      if (ticketError) throw ticketError;

      // Zápis úvodnej správy do ticket_comments
      const { error: commentError } = await supabase.from('ticket_comments').insert({
        ticket_id: ticket.id,
        discord_message_id: thread.lastMessageId,
        author_discord_id: interaction.user.id,
        author_name: interaction.user.username,
        author_avatar_url: interaction.user.displayAvatarURL(),
        content: description,
        is_from_admin: false
      });

      if (commentError) throw commentError;

      await interaction.editReply(`✅ Úspešne vytvorené! Sleduj svoj ticket tu: <#${thread.id}>`);
    } catch (error) {
      console.error('Error handling modal submit:', error);
      await interaction.editReply('❌ Nastala chyba pri vytváraní ticketu. Kontaktuj administrátora.');
    }
  }
}
