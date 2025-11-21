// handlers/ticketButtons.js
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
} = require('discord.js');

const OPEN_ID = 'ticket_open';
const CLOSE_ID = 'ticket_close';
const DELETE_ID = 'ticket_delete';
const ADD_ID = 'ticket_add';
const REMOVE_ID = 'ticket_remove';
const ADD_MODAL_ID = 'ticket_add_modal';
const REMOVE_MODAL_ID = 'ticket_remove_modal';
const USER_INPUT_ID = 'user_id';

function isStaff(member) {
  if (!member) return false;

  if (member.permissions?.has(PermissionFlagsBits.Administrator)) return true;

  const adminRoleId = process.env.ADMIN_ROLE_ID;
  const modRoleId = process.env.MODERATOR_ROLE_ID;

  if (adminRoleId && member.roles?.cache?.has(adminRoleId)) return true;
  if (modRoleId && member.roles?.cache?.has(modRoleId)) return true;

  // owner du serveur
  if (member.guild?.ownerId && member.id === member.guild.ownerId) return true;

  return false;
}

async function safeReply(interaction, options) {
  try {
    if (interaction.replied || interaction.deferred) {
      // on update si possible
      if (interaction.isRepliable()) {
        return interaction.followUp({ ...options, ephemeral: true }).catch(() => {});
      }
      return;
    }
    return await interaction.reply(options);
  } catch (err) {
    if (err.code === 'InteractionAlreadyReplied') return;
    console.error('ticketButtons safeReply error:', err);
  }
}

module.exports = {
  register(client) {
    // 🔒 anti double-enregistrement (qui causait le bug)
    if (client._ticketButtonsRegistered) return;
    client._ticketButtonsRegistered = true;

    client.on('interactionCreate', async (interaction) => {
      try {
        // ===================== BOUTONS =====================
        if (interaction.isButton()) {
          const id = interaction.customId;

          // ---------- OUVERTURE ----------
          if (id === OPEN_ID) {
            const guild = interaction.guild;
            if (!guild) return;

            const categoryId = process.env.TICKET_CATEGORY_ID;
            if (!categoryId) {
              return safeReply(interaction, {
                content: '❌ Configuration invalide : `TICKET_CATEGORY_ID` est vide.',
                ephemeral: true,
              });
            }

            const category = guild.channels.cache.get(categoryId);
            if (!category || category.type !== ChannelType.GuildCategory) {
              return safeReply(interaction, {
                content: '❌ La catégorie de tickets est introuvable ou n’est pas une catégorie.',
                ephemeral: true,
              });
            }

            const user = interaction.user;

            // évite les tickets en double
            const existing = guild.channels.cache.find(
              (ch) =>
                ch.parentId === categoryId &&
                ch.type === ChannelType.GuildText &&
                ch.topic &&
                ch.topic.includes(`ticketOwner:${user.id}`)
            );
            if (existing) {
              return safeReply(interaction, {
                content: `⚠️ Vous avez déjà un ticket ouvert : ${existing}`,
                ephemeral: true,
              });
            }

            const baseName = `ticket-${user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '');
            let name = baseName;
            let idx = 1;
            while (guild.channels.cache.some((c) => c.name === name && c.parentId === categoryId)) {
              name = `${baseName}-${idx++}`;
            }

            const overwrites = [
              {
                id: guild.roles.everyone.id,
                deny: [PermissionFlagsBits.ViewChannel],
              },
              {
                id: user.id,
                allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ReadMessageHistory,
                  PermissionFlagsBits.AttachFiles,
                  PermissionFlagsBits.EmbedLinks,
                ],
              },
            ];

            const adminRoleId = process.env.ADMIN_ROLE_ID;
            const modRoleId = process.env.MODERATOR_ROLE_ID;

            if (modRoleId) {
              overwrites.push({
                id: modRoleId,
                allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ReadMessageHistory,
                  PermissionFlagsBits.ManageMessages,
                ],
              });
            }

            if (adminRoleId) {
              overwrites.push({
                id: adminRoleId,
                allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ReadMessageHistory,
                  PermissionFlagsBits.ManageMessages,
                  PermissionFlagsBits.ManageChannels,
                ],
              });
            }

            if (guild.members.me?.id) {
              overwrites.push({
                id: guild.members.me.id,
                allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ReadMessageHistory,
                  PermissionFlagsBits.ManageChannels,
                  PermissionFlagsBits.ManageMessages,
                  PermissionFlagsBits.AttachFiles,
                  PermissionFlagsBits.EmbedLinks,
                ],
              });
            }

            const channel = await guild.channels.create({
              name,
              type: ChannelType.GuildText,
              parent: category.id,
              topic: `ticketOwner:${user.id}`,
              permissionOverwrites: overwrites,
              reason: `Ticket ouvert par ${user.tag}`,
            });

            const embed = new EmbedBuilder()
              .setTitle('🎫 Ticket ouvert')
              .setDescription(
                `Bonjour ${user}, merci de détailler votre demande.\nUn membre du staff vous répondra dès que possible.`
              )
              .setColor(0x2b2d31)
              .setTimestamp(new Date());

            const row = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(CLOSE_ID)
                .setLabel('Fermer')
                .setStyle(ButtonStyle.Secondary),
              new ButtonBuilder()
                .setCustomId(ADD_ID)
                .setLabel('Ajouter')
                .setStyle(ButtonStyle.Primary),
              new ButtonBuilder()
                .setCustomId(REMOVE_ID)
                .setLabel('Retirer')
                .setStyle(ButtonStyle.Primary),
            );


            const rolePings = [];
            if (adminRoleId) rolePings.push(`<@&${adminRoleId}>`);
            if (modRoleId) rolePings.push(`<@&${modRoleId}>`);

            let pingLine = '';
            if (rolePings.length > 0) {
              pingLine = rolePings.join(' ') + '\n';
            }

            const content = `${pingLine}<@${user.id}> a ouvert un ticket.`;

            await channel.send({ content, embeds: [embed], components: [row] });

            return safeReply(interaction, {
              content: `🎫 Ticket créé : ${channel}`,
              ephemeral: true,
            });

          }

          // ---------- FERMER ----------
          if (id === CLOSE_ID) {
            const ch = interaction.channel;
            const guild = interaction.guild;
            if (!ch || !guild) return;

            const topic = ch.topic || '';
            const match = topic.match(/ticketOwner:(\d{10,40})/);
            const ownerId = match ? match[1] : null;

            const member = interaction.member;
            const isOwner = ownerId && interaction.user.id === ownerId;

            if (!isOwner && !isStaff(member)) {
              return safeReply(interaction, {
                content: '❌ Seul le demandeur du ticket ou le staff peut le fermer.',
                ephemeral: true,
              });
            }

            if (ownerId) {
              await ch.permissionOverwrites.edit(ownerId, {
                ViewChannel: false,
                SendMessages: false,
                ReadMessageHistory: false,
              }).catch(() => {});
            }

            if (!ch.name.startsWith('closed-')) {
              await ch.setName(`closed-${ch.name}`).catch(() => {});
            }

            // Message de log dans le salon
            await ch.send('🔒 Ticket fermé. Le demandeur n’a plus accès, le staff conserve l’accès.');

            // On envoie un deuxième message avec le bouton SUPPRIMER (visible après fermeture)
            const deleteRow = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(DELETE_ID)
                .setLabel('Supprimer le ticket')
                .setStyle(ButtonStyle.Danger),
            );

            await ch.send({
              content: '🗑️ **Staff uniquement** : cliquez sur ce bouton pour supprimer définitivement ce ticket.',
              components: [deleteRow],
            });

            return safeReply(interaction, {
              content: '✔️ Ticket fermé.',
              ephemeral: true,
            });

          }

          // ---------- SUPPRIMER (STAFF) ----------
          if (id === DELETE_ID) {
            if (!isStaff(interaction.member)) {
              return safeReply(interaction, {
                content: '❌ Seul le staff peut supprimer un ticket.',
                ephemeral: true,
              });
            }

            await safeReply(interaction, {
              content: '🗑️ Ticket en cours de suppression…',
              ephemeral: true,
            });

            return interaction.channel.delete('Ticket supprimé par le staff.').catch(() => {});
          }

          // ---------- AJOUT ----------
          if (id === ADD_ID) {
            if (!isStaff(interaction.member)) {
              return safeReply(interaction, {
                content: '❌ Seul le staff peut modifier les accès du ticket.',
                ephemeral: true,
              });
            }

            const modal = new ModalBuilder()
              .setCustomId(ADD_MODAL_ID)
              .setTitle('Ajouter un utilisateur au ticket');

            const input = new TextInputBuilder()
              .setCustomId(USER_INPUT_ID)
              .setLabel('ID ou @mention de l’utilisateur')
              .setStyle(TextInputStyle.Short)
              .setRequired(true);

            const row = new ActionRowBuilder().addComponents(input);
            modal.addComponents(row);

            return interaction.showModal(modal);
          }

          // ---------- RETIRER ----------
          if (id === REMOVE_ID) {
            if (!isStaff(interaction.member)) {
              return safeReply(interaction, {
                content: '❌ Seul le staff peut modifier les accès du ticket.',
                ephemeral: true,
              });
            }

            const modal = new ModalBuilder()
              .setCustomId(REMOVE_MODAL_ID)
              .setTitle('Retirer un utilisateur du ticket');

            const input = new TextInputBuilder()
              .setCustomId(USER_INPUT_ID)
              .setLabel('ID ou @mention de l’utilisateur')
              .setStyle(TextInputStyle.Short)
              .setRequired(true);

            const row = new ActionRowBuilder().addComponents(input);
            modal.addComponents(row);

            return interaction.showModal(modal);
          }
        }

        // ===================== MODALS =====================
        if (interaction.isModalSubmit()) {
          const id = interaction.customId;
          const ch = interaction.channel;
          const guild = interaction.guild;
          if (!ch || !guild) return;

          if (![ADD_MODAL_ID, REMOVE_MODAL_ID].includes(id)) return;

          if (!isStaff(interaction.member)) {
            return safeReply(interaction, {
              content: '❌ Seul le staff peut modifier les accès du ticket.',
              ephemeral: true,
            });
          }

          const raw = interaction.fields.getTextInputValue(USER_INPUT_ID).trim();
          const match = raw.match(/\d{10,40}/);
          const targetId = match ? match[0] : null;

          if (!targetId) {
            return safeReply(interaction, {
              content: '❌ ID ou mention invalide.',
              ephemeral: true,
            });
          }

          if (id === ADD_MODAL_ID) {
            await ch.permissionOverwrites
              .edit(targetId, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true,
                AttachFiles: true,
                EmbedLinks: true,
              })
              .catch(() => {});

            await safeReply(interaction, {
              content: `✔️ <@${targetId}> a été **ajouté** au ticket.`,
              ephemeral: true,
            });

            await ch.send(`➕ <@${targetId}> a été ajouté au ticket par ${interaction.user}.`);
          }

          if (id === REMOVE_MODAL_ID) {
            await ch.permissionOverwrites
              .edit(targetId, {
                ViewChannel: false,
                SendMessages: false,
                ReadMessageHistory: false,
              })
              .catch(() => {});

            await safeReply(interaction, {
              content: `✔️ <@${targetId}> a été **retiré** du ticket.`,
              ephemeral: true,
            });

            await ch.send(`➖ <@${targetId}> a été retiré du ticket par ${interaction.user}.`);
          }
        }
      } catch (err) {
        console.error('ticketButtons global error:', err);
      }
    });
  },
};
