// commands/info/help.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Afficher la liste des commandes ou l’aide pour une commande précise')
    .addStringOption(option =>
      option
        .setName('commande')
        .setDescription('Nom d’une commande (optionnel)')
        .setRequired(false)
    ),

  meta: {
    guildOnly: true,
    cooldownMs: 3000
  },

  async execute(interaction) {
    const cmdName = interaction.options.getString('commande');

    // ================= HELP DÉTAILLÉ POUR UNE COMMANDE =================
    if (cmdName) {
      const command = interaction.client.commands.get(cmdName);
      if (!command) {
        return interaction.reply({
          content: `❌ Commande \`${cmdName}\` inconnue.`,
          ephemeral: true
        });
      }

      const embed = new EmbedBuilder()
        .setTitle(`❓ Aide — /${command.data.name}`)
        .setColor(0x5865f2)
        .setDescription(command.data.description || 'Aucune description fournie.')
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ================= HELP GLOBAL (LISTE DES COMMANDES) =================

    const embed = new EmbedBuilder()
      .setTitle('📘 Aide — Liste des commandes')
      .setColor(0x5865f2)
      .setDescription(
        'Voici les principales commandes disponibles sur le serveur.\n' +
        'Utilise `/help commande:<nom>` pour plus de détails sur une commande précise.'
      )
      .setTimestamp();

    // Modération Discord (rôles + actions)
    embed.addFields(
      {
        name: '🛡️ Modération Discord — Rôles',
        value:
          '• `/addmodo` — Ajouter un modérateur sur Twitch\n' +
          '• `/removemodo` — Retirer un modérateur sur Twitch\n' +
          '• `/addvip` — Ajouter un VIP sur Twitch\n' +
          '• `/removevip` — Retirer un VIP sur Twitch\n' +
          '• `/listmods` — Lister les modérateurs Twitch\n' +
          '• `/listvips` — Lister les VIP Twitch',
        inline: false
      },
      {
        name: '⚔️ Modération Discord — Actions',
        value:
          '• `/mute` — Muter un utilisateur (timeout)\n' +
          '• `/unmute` — Démuter un utilisateur\n' +
          '• `/kick` — Expulser un utilisateur\n' +
          '• `/discordban` — Bannir un utilisateur\n' +
          '• `/unban` — Débannir un utilisateur (ID)\n' +
          '• `/clear` — Supprimer des messages (1–100)\n' +
          '• `/warn` — Avertir un utilisateur\n' +
          '• `/userinfo` — Infos sur un utilisateur\n' +
          '• `/listbans` — Lister les bannis Discord',
        inline: false
      }
    );

    // Commandes Twitch
    embed.addFields(
      {
        name: '📺 Commandes Twitch',
        value:
          '• `/twitchaddmod` — Ajouter un modérateur Twitch\n' +
          '• `/twitchremovemod` — Retirer un modérateur Twitch\n' +
          '• `/twitchban` — Bannir sur Twitch\n' +
          '• `/twitchunban` — Débannir sur Twitch\n' +
          '• `/twitchtimeout` — Timeout sur Twitch\n' +
          '• `/twitchsearch` — Rechercher un utilisateur Twitch\n' +
          '• `/twitchbans` — Lister les bannis Twitch (embed paginé)\n' +
          '• `/twitchlistbans` — Lister les bannis Twitch (liste paginée)',
        inline: false
      }
    );

    // Vocaux + tickets
    embed.addFields(
      {
        name: '🎤 Salons vocaux temporaires',
        value:
          '• `/rename` — Renommer votre salon vocal\n' +
          '• `/limit` — Limiter le nombre d’utilisateurs (0 = illimité)\n' +
          '• `/lock` — Verrouiller votre salon vocal\n' +
          '• `/unlock` — Déverrouiller votre salon vocal\n' +
          '• `/transfer` — Transférer la propriété du salon',
        inline: false
      },
      {
        name: '🎫 Tickets & bienvenue',
        value:
          '• `/ticketpanel` — Publier un panneau pour ouvrir des tickets (embed + bouton)\n' +
          '• `/welcome` — Gérer le système de bienvenue (toggle/add/remove/test)',
        inline: false
      }
    );

    // Info / système
    embed.addFields(
      {
        name: 'ℹ️ Informations & système',
        value:
          '• `/botinfo` — Informations sur le bot\n' +
          '• `/ping` — Vérifier la latence\n' +
          '• `/streaminfo` — Informations sur le stream\n' +
          '• `/systemcheck` — Vérifier l’état des systèmes\n' +
          '• `/admin` — Commandes administrateur (réservé staff)',
        inline: false
      }
    );

    return interaction.reply({
      embeds: [embed],
      ephemeral: false, // si tu veux éviter le warning plus tard, on passera ça en flags
      flags: 0,
    });
  }
};
