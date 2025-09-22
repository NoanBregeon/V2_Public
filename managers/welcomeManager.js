const { EmbedBuilder } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

class WelcomeManager {
    constructor(client, config) {
        this.client = client;
        this.config = config;
        this.settings = {
            enabled: false,
            joinMessage: 'Bienvenue {user} sur le serveur !',
            leaveMessage: '{user} a quitté le serveur.',
            channelId: null
        };
        this.settingsFile = path.join(__dirname, '../data/welcome-settings.json');
        this.loadSettings();
    }

    async initialize() {
        console.log('👋 Initialisation du WelcomeManager...');
        await this.loadSettings();
        this.setupEvents();
        console.log('✅ WelcomeManager initialisé');
    }

    async loadSettings() {
        try {
            const data = await fs.readFile(this.settingsFile, 'utf8');
            this.settings = { ...this.settings, ...JSON.parse(data) };
        } catch (error) {
            // Fichier n'existe pas encore, utiliser les paramètres par défaut
            await this.saveSettings();
        }
    }

    async saveSettings() {
        try {
            // Créer le dossier data s'il n'existe pas
            const dataDir = path.dirname(this.settingsFile);
            await fs.mkdir(dataDir, { recursive: true });
            
            await fs.writeFile(this.settingsFile, JSON.stringify(this.settings, null, 2));
        } catch (error) {
            console.error('❌ Erreur sauvegarde paramètres bienvenue:', error);
        }
    }

    setupEvents() {
        this.client.on('guildMemberAdd', async (member) => {
            if (this.settings.enabled && this.settings.joinMessage) {
                await this.sendWelcomeMessage(member, 'join');
            }
        });

        this.client.on('guildMemberRemove', async (member) => {
            if (this.settings.enabled && this.settings.leaveMessage) {
                await this.sendWelcomeMessage(member, 'leave');
            }
        });
    }

    async handleSlashCommand(interaction) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'toggle':
                await this.toggleSystem(interaction);
                break;
            case 'add':
                await this.addMessage(interaction);
                break;
            case 'remove':
                await this.removeMessage(interaction);
                break;
            case 'test':
                await this.testMessage(interaction);
                break;
        }
    }

    async toggleSystem(interaction) {
        const enabled = interaction.options.getBoolean('activer');
        this.settings.enabled = enabled;
        
        if (enabled && !this.settings.channelId) {
            this.settings.channelId = interaction.channel.id;
        }
        
        await this.saveSettings();

        const embed = new EmbedBuilder()
            .setTitle('👋 Système de bienvenue')
            .setDescription(`Le système a été ${enabled ? 'activé' : 'désactivé'}`)
            .addFields(
                { name: 'État', value: enabled ? '🟢 Activé' : '🔴 Désactivé', inline: true },
                { name: 'Canal', value: enabled ? `<#${this.settings.channelId}>` : 'Non défini', inline: true }
            )
            .setColor(enabled ? 0x00FF00 : 0xFF0000)
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }

    async addMessage(interaction) {
        const type = interaction.options.getString('type');
        const message = interaction.options.getString('message');

        if (type === 'join') {
            this.settings.joinMessage = message;
        } else if (type === 'leave') {
            this.settings.leaveMessage = message;
        }

        await this.saveSettings();

        const embed = new EmbedBuilder()
            .setTitle('👋 Message ajouté')
            .setDescription(`Message de ${type === 'join' ? 'bienvenue' : 'départ'} mis à jour`)
            .addFields({ name: 'Message', value: message, inline: false })
            .setColor(0x00FF00)
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }

    async removeMessage(interaction) {
        const type = interaction.options.getString('type');

        if (type === 'join') {
            this.settings.joinMessage = null;
        } else if (type === 'leave') {
            this.settings.leaveMessage = null;
        }

        await this.saveSettings();

        const embed = new EmbedBuilder()
            .setTitle('👋 Message supprimé')
            .setDescription(`Message de ${type === 'join' ? 'bienvenue' : 'départ'} supprimé`)
            .setColor(0xFF6600)
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }

    async testMessage(interaction) {
        const member = interaction.member;
        
        const embed = new EmbedBuilder()
            .setTitle('🧪 Test du système de bienvenue')
            .setDescription('Messages qui seraient envoyés :')
            .setColor(0x3498DB);

        const fields = [];

        if (this.settings.joinMessage) {
            const joinMsg = this.formatMessage(this.settings.joinMessage, member);
            fields.push({ name: '👋 Message d\'arrivée', value: joinMsg, inline: false });
        }

        if (this.settings.leaveMessage) {
            const leaveMsg = this.formatMessage(this.settings.leaveMessage, member);
            fields.push({ name: '👋 Message de départ', value: leaveMsg, inline: false });
        }

        if (fields.length === 0) {
            fields.push({ name: 'Aucun message', value: 'Aucun message configuré', inline: false });
        }

        embed.addFields(fields);
        embed.addFields(
            { name: 'État du système', value: this.settings.enabled ? '🟢 Activé' : '🔴 Désactivé', inline: true },
            { name: 'Canal', value: this.settings.channelId ? `<#${this.settings.channelId}>` : 'Non défini', inline: true }
        );

        await interaction.reply({ embeds: [embed] });
    }

    async sendWelcomeMessage(member, type) {
        if (!this.settings.channelId) return;

        const channel = member.guild.channels.cache.get(this.settings.channelId);
        if (!channel) return;

        const message = type === 'join' ? this.settings.joinMessage : this.settings.leaveMessage;
        if (!message) return;

        const formattedMessage = this.formatMessage(message, member);

        try {
            const embed = new EmbedBuilder()
                .setDescription(formattedMessage)
                .setColor(type === 'join' ? 0x00FF00 : 0xFF6600)
                .setThumbnail(member.user.displayAvatarURL())
                .setTimestamp();

            if (type === 'join') {
                embed.setTitle('👋 Nouveau membre');
            } else {
                embed.setTitle('👋 Membre parti');
            }

            await channel.send({ embeds: [embed] });
        } catch (error) {
            console.error('❌ Erreur envoi message bienvenue:', error);
        }
    }

    formatMessage(message, member) {
        return message
            .replace(/\{user\}/g, `<@${member.id}>`)
            .replace(/\{username\}/g, member.user.username)
            .replace(/\{tag\}/g, member.user.tag)
            .replace(/\{server\}/g, member.guild.name)
            .replace(/\{membercount\}/g, member.guild.memberCount);
    }
}

module.exports = WelcomeManager;
