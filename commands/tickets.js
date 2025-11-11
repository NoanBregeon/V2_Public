const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const ticketService = require('../services/ticketService');
module.exports = { data:new SlashCommandBuilder().setName('ticketpanel').setDescription('Publier le panneau d’ouverture de tickets').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels).setDMPermission(false), async execute(interaction){ await ticketService.createPanel(interaction.channel); await interaction.reply({ content:'✅ Panneau de tickets publié ici.', flags:64 }); } };
