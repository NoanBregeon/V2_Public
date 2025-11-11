const { ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
function staffRoleId(){ return process.env.ADMIN_ROLE_ID || process.env.MODERATOR_ROLE_ID; }
async function createTicketChannel(guild, opener){
  const parentId = process.env.VOICE_CATEGORY_ID || null;
  const overwrites = [
    { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
    { id: opener.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
  ];
  const staff = staffRoleId();
  if (staff) overwrites.push({ id: staff, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] });

  const channel = await guild.channels.create({ name:`ticket-${opener.user.username}`.toLowerCase(), type: ChannelType.GuildText, parent: parentId || undefined, permissionOverwrites: overwrites });
  const closeBtn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ticket_close').setStyle(ButtonStyle.Danger).setLabel('Fermer le ticket'));
  const embed = new EmbedBuilder().setTitle('🎫 Ticket Ouvert').setDescription(`Bonjour ${opener}, un membre du staff va vous répondre.`).setColor(0x5865F2);
  await channel.send({ content: `<@${opener.id}>`, embeds: [embed], components: [closeBtn] });
  return channel;
}
async function handleButton(interaction){
  if (interaction.customId === 'ticket_open'){ await interaction.deferUpdate(); const chan = await createTicketChannel(interaction.guild, interaction.member); try { await interaction.user.send(`✅ Ticket ouvert: #${chan.name}`); } catch {} return; }
  if (interaction.customId === 'ticket_close'){ if (!interaction.channel) return; await interaction.reply({ content: '🔒 Ticket fermé. Le salon sera supprimé dans 5 secondes.', flags: 64 }); setTimeout(()=> interaction.channel.delete().catch(()=>null), 5000); return; }
}
async function createPanel(channel){ const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ticket_open').setStyle(ButtonStyle.Primary).setLabel('🎫 Ouvrir un ticket')); await channel.send({ content: '**Support** — Cliquez pour ouvrir un ticket privé.', components: [row] }); }
module.exports = { handleButton, createPanel };
