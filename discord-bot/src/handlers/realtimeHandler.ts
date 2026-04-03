import { Client, ThreadChannel } from 'discord.js';
import { supabase } from '../supabase';

export function setupRealtimeListener(client: Client) {
  console.log('Setting up Supabase Realtime listener...');

  supabase.channel('admin-responses')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'ticket_comments',
        filter: 'is_from_admin=eq.true'
      },
      async (payload) => {
        try {
          const comment = payload.new;

          // Ak už má discord_message_id, znamená to, že to nebola nová správa z webu
          if (comment.discord_message_id) return;

          // Získame ticket, aby sme zistili discord_thread_id
          const { data: ticket, error: ticketError } = await supabase
            .from('tickets')
            .select('discord_thread_id')
            .eq('id', comment.ticket_id)
            .single();

          if (ticketError || !ticket) {
            console.error('Ticket not found for comment:', comment.id);
            return;
          }

          // Nájdeme thread na Discorde
          const channel = await client.channels.fetch(ticket.discord_thread_id);
          if (!channel || !channel.isThread()) {
            console.error('Discord thread not found:', ticket.discord_thread_id);
            return;
          }

          const thread = channel as ThreadChannel;

          // Odošleme správu do Discordu
          const discordMessage = await thread.send({
            content: `**[Developer Response - ${comment.author_name}]**\n${comment.content}`
          });

          // Updatneme záznam v DB s discord_message_id
          await supabase
            .from('ticket_comments')
            .update({ discord_message_id: discordMessage.id })
            .eq('id', comment.id);

          console.log(`Successfully synced admin response to Discord thread ${thread.id}`);
        } catch (error) {
          console.error('Error in realtime handler:', error);
        }
      }
    )
    .subscribe((status) => {
      console.log('Supabase Realtime status:', status);
    });
}
