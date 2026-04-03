import { Message, Attachment } from 'discord.js';
import { supabase } from '../supabase';

const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 
  'video/mp4', 'video/webm'
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB limit pre Supabase Storage

export async function handleMessageCreate(message: Message) {
  // Ignorujeme botov
  if (message.author.bot) return;

  // Skontrolujeme, či je správa v threade
  if (!message.channel.isThread()) return;

  try {
    // Zistíme, či tento thread patrí k nejakému ticketu v DB
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('id')
      .eq('discord_thread_id', message.channel.id)
      .single();

    if (ticketError || !ticket) return; // Nie je to náš ticket thread

    // Uložíme textovú správu
    const { data: comment, error: commentError } = await supabase
      .from('ticket_comments')
      .insert({
        ticket_id: ticket.id,
        discord_message_id: message.id,
        author_discord_id: message.author.id,
        author_name: message.author.username,
        author_avatar_url: message.author.displayAvatarURL(),
        content: message.content || '*Príloha*',
        is_from_admin: false
      })
      .select()
      .single();

    if (commentError) throw commentError;

    // Spracovanie príloh (Media Proxy)
    if (message.attachments.size > 0) {
      for (const [_, attachment] of message.attachments) {
        await proxyDiscordAttachment(attachment, comment.id);
      }
    }

  } catch (error) {
    console.error('Error handling message create:', error);
  }
}

async function proxyDiscordAttachment(attachment: Attachment, commentId: string) {
  try {
    // 1. Validácia typu a veľkosti
    if (!attachment.contentType || !ALLOWED_MIME_TYPES.includes(attachment.contentType)) {
      console.warn(`Nepovolený typ súboru: ${attachment.contentType}`);
      return;
    }

    if (attachment.size > MAX_FILE_SIZE) {
      console.warn(`Súbor je príliš veľký: ${attachment.size} bytes`);
      return;
    }

    // 2. Stiahnutie súboru z Discordu do pamäte
    const response = await fetch(attachment.url);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 3. Generovanie unikátnej cesty
    const safeFileName = attachment.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `attachments/${commentId}/${attachment.id}_${safeFileName}`;

    // 4. Upload do Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('ticket-media')
      .upload(filePath, buffer, {
        contentType: attachment.contentType,
        upsert: true
      });

    if (uploadError) throw uploadError;

    // 5. Uloženie referencie do databázy
    await supabase.from('ticket_media').insert({
      comment_id: commentId,
      discord_attachment_id: attachment.id,
      file_name: attachment.name,
      content_type: attachment.contentType,
      supabase_storage_path: filePath
    });

  } catch (error) {
    console.error('Failed to proxy attachment:', error);
  }
}
