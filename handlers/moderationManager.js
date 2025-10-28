/**
 * Gestionnaire de modération
 */

const { EmbedBuilder } = require('discord.js');

class ModerationManager {
    constructor(client, config) {
        this.client = client;
        this.config = config;
    }

    async initialize() {
        console.log('✅ ModerationManager initialisé');
    }

    async handleModerationCommand(interaction, subcommand) {
        // Vérifier les permissions de modération
        if (!interaction.member.permissions.has('ModerateMembers')) {
            return interaction.reply({
                content: '❌ Vous n\'avez pas les permissions nécessaires.',
                ephemeral: true
            });
        }

        switch (subcommand) {
            case 'ban':
                return this.handleBan(interaction);
            case 'kick':
                return this.handleKick(interaction);
            case 'timeout':
                return this.handleTimeout(interaction);
            case 'warn':
                return this.handleWarn(interaction);
            default:
                return interaction.reply({ content: '❌ Sous-commande inconnue', ephemeral: true });
        }
    }

    async handleBan(interaction) {
        const user = interaction.options.getUser('utilisateur');
        const reason = interaction.options.getString('raison') || 'Aucune raison spécifiée';
        
        try {
            await interaction.guild.members.ban(user, { reason });
            
            const embed = new EmbedBuilder()
                .setTitle('🔨 Utilisateur banni')
                .setDescription(`**Utilisateur:** ${user.tag}\n**Raison:** ${reason}\n**Modérateur:** ${interaction.user.tag}`)
                .setColor(0xE74C3C)
                .setTimestamp();
            
            await this.logModeration(embed);
            
            return interaction.reply({
                content: `✅ ${user.tag} a été banni.`,
                ephemeral: true
            });
            
        } catch (error) {
            console.error('❌ Erreur ban:', error);
            return interaction.reply({
                content: '❌ Erreur lors du bannissement.',
                ephemeral: true
            });
        }
    }

    async handleKick(interaction) {
        const user = interaction.options.getUser('utilisateur');
        const reason = interaction.options.getString('raison') || 'Aucune raison spécifiée';
        
        try {
            const member = await interaction.guild.members.fetch(user.id);
            await member.kick(reason);
            
            const embed = new EmbedBuilder()
                .setTitle('👢 Utilisateur expulsé')
                .setDescription(`**Utilisateur:** ${user.tag}\n**Raison:** ${reason}\n**Modérateur:** ${interaction.user.tag}`)
                .setColor(0xF39C12)
                .setTimestamp();
            
            await this.logModeration(embed);
            
            return interaction.reply({
                content: `✅ ${user.tag} a été expulsé.`,
                ephemeral: true
            });
            
        } catch (error) {
            console.error('❌ Erreur kick:', error);
            return interaction.reply({
                content: '❌ Erreur lors de l\'expulsion.',
                ephemeral: true
            });
        }
    }

    async handleTimeout(interaction) {
        const user = interaction.options.getUser('utilisateur');
        const duration = interaction.options.getInteger('duree'); // en minutes
        const reason = interaction.options.getString('raison') || 'Aucune raison spécifiée';
        
        try {
            const member = await interaction.guild.members.fetch(user.id);
            const timeoutDuration = duration * 60 * 1000; // Convertir en millisecondes
            
            await member.timeout(timeoutDuration, reason);
            
            const embed = new EmbedBuilder()
                .setTitle('⏰ Utilisateur mis en timeout')
                .setDescription(`**Utilisateur:** ${user.tag}\n**Durée:** ${duration} minutes\n**Raison:** ${reason}\n**Modérateur:** ${interaction.user.tag}`)
                .setColor(0x9B59B6)
                .setTimestamp();
            
            await this.logModeration(embed);
            
            return interaction.reply({
                content: `✅ ${user.tag} a été mis en timeout pour ${duration} minutes.`,
                ephemeral: true
            });
            
        } catch (error) {
            console.error('❌ Erreur timeout:', error);
            return interaction.reply({
                content: '❌ Erreur lors du timeout.',
                ephemeral: true
            });
        }
    }

    async handleWarn(interaction) {
        const user = interaction.options.getUser('utilisateur');
        const reason = interaction.options.getString('raison') || 'Aucune raison spécifiée';
        
        try {
            const embed = new EmbedBuilder()
                .setTitle('⚠️ Utilisateur averti')
                .setDescription(`**Utilisateur:** ${user.tag}\n**Raison:** ${reason}\n**Modérateur:** ${interaction.user.tag}`)
                .setColor(0xF1C40F)
                .setTimestamp();
            
            await this.logModeration(embed);
            
            // Envoyer un MP à l'utilisateur
            try {
                await user.send(`⚠️ **Avertissement sur ${interaction.guild.name}**\n**Raison:** ${reason}`);
            } catch {
                // L'utilisateur a probablement désactivé les MPs
            }
            
            return interaction.reply({
                content: `✅ ${user.tag} a été averti.`,
                ephemeral: true
            });
            
        } catch (error) {
            console.error('❌ Erreur warn:', error);
            return interaction.reply({
                content: '❌ Erreur lors de l\'avertissement.',
                ephemeral: true
            });
        }
    }

    async logModeration(embed) {
        if (!this.config.moderationChannelId) return;
        
        try {
            const logChannel = await this.client.channels.fetch(this.config.moderationChannelId);
            if (logChannel) {
                await logChannel.send({ embeds: [embed] });
            }
        } catch (error) {
            console.error('❌ Erreur log modération:', error);
        }
    }
}

module.exports = ModerationManager;