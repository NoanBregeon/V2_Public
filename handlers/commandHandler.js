/**
 * Gestionnaire de commandes avec sécurité renforcée
 */

const { REST, Routes, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const PermissionManager = require('../utils/permissions');

class CommandHandler {
    constructor(client, config) {
        this.client = client;
        this.config = config;
        this.commands = new Collection();
        this.permissionManager = new PermissionManager(config);
    }

    async initialize() {
        await this.loadCommands();
        await this.registerSlashCommands();
        console.log('✅ CommandHandler initialisé avec système de permissions');
    }

    async handleInteraction(interaction) {
        if (!interaction.isChatInputCommand()) return;

        const command = interaction.commandName;
        
        // SÉCURITÉ: Vérification des permissions pour commandes Twitch sensibles
        if (!this.permissionManager.canUseTwitchAdminCommand(interaction.member, command)) {
            // Log de la tentative non autorisée
            this.permissionManager.logUnauthorizedAccess(
                interaction.member, 
                command, 
                interaction.channelId
            );
            
            return interaction.reply({
                content: this.permissionManager.getPermissionError('administrateur'),
                ephemeral: true
            });
        }

        // Vérification des permissions de base pour autres commandes Twitch
        if (this.isTwitchCommand(command) && !this.permissionManager.canUseTwitchCommand(interaction.member)) {
            return interaction.reply({
                content: this.permissionManager.getPermissionError('modérateur'),
                ephemeral: true
            });
        }

        // Exécution de la commande
        const commandHandler = this.commands.get(command);
        if (commandHandler) {
            try {
                await commandHandler.execute(interaction);
            } catch (error) {
                console.error(`❌ Erreur commande ${command}:`, error);
                const content = '❌ Une erreur est survenue lors de l\'exécution de la commande.';
                
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content, ephemeral: true });
                } else {
                    await interaction.reply({ content, ephemeral: true });
                }
            }
        } else {
            // Commande non trouvée
            return interaction.reply({
                content: `❌ Commande "${command}" non trouvée.`,
                ephemeral: true
            });
        }
    }

    async handleMessage(message) {
        // Gestion des commandes préfixées UNIQUEMENT pour les modérateurs/admins
        if (!message.content.startsWith('!')) return;
        
        const args = message.content.slice(1).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();
        
        // Vérifier si l'utilisateur est au moins modérateur pour les commandes préfixées
        const isModerator = this.permissionManager.isModerator(message.member);
        const isAdmin = this.permissionManager.isAdmin(message.member);
        
        if (!isModerator && !isAdmin) {
            // Les membres normaux ne peuvent pas utiliser les commandes préfixées
            return;
        }
        
        // Commandes préfixées RÉSERVÉES aux modérateurs/admins uniquement
        const voiceManager = this.client.moduleManager?.getModule('voiceManager');
        if (voiceManager && message.member.voice?.channel) {
            const tempChannels = voiceManager.tempChannels;
            const voiceChannel = message.member.voice.channel;
            
            if (tempChannels.has(voiceChannel.id) && tempChannels.get(voiceChannel.id) === message.author.id) {
                switch (commandName) {
                    case 'rename':
                        if (args.length > 0) {
                            const newName = args.join(' ');
                            try {
                                await voiceChannel.setName(newName);
                                await message.react('✅');
                                return;
                            } catch (error) {
                                await message.react('❌');
                                return;
                            }
                        }
                        break;
                    case 'lock':
                        try {
                            await voiceChannel.permissionOverwrites.edit(voiceChannel.guild.roles.everyone, {
                                Connect: false
                            });
                            await message.react('🔒');
                            return;
                        } catch (error) {
                            await message.react('❌');
                            return;
                        }
                    case 'unlock':
                        try {
                            await voiceChannel.permissionOverwrites.edit(voiceChannel.guild.roles.everyone, {
                                Connect: null
                            });
                            await message.react('🔓');
                            return;
                        } catch (error) {
                            await message.react('❌');
                            return;
                        }
                }
            }
        }
        
        // Commande ping de base (réservée aux modérateurs)
        if (commandName === 'ping') {
            return message.reply('Pong! 🏓 (Commande réservée aux modérateurs)');
        }
    }

    /**
     * Vérifie si une commande est liée à Twitch
     */
    isTwitchCommand(commandName) {
        return commandName.startsWith('twitch-') || 
               commandName.includes('vip') || 
               commandName.includes('mod') ||
               commandName.includes('subscriber');
    }

    async loadCommands() {
        const commandsPath = path.join(__dirname, '../commands');
        if (!fs.existsSync(commandsPath)) {
            console.warn('⚠️ Dossier commands introuvable');
            return;
        }

        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
        
        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            const command = require(filePath);
            
            if ('data' in command && 'execute' in command) {
                this.commands.set(command.data.name, command);
            }
        }
        
        console.log(`📋 ${this.commands.size} commandes chargées`);
    }

    async registerSlashCommands() {
        const commands = Array.from(this.commands.values()).map(cmd => cmd.data.toJSON());
        
        const rest = new REST().setToken(this.config.discordToken);
        
        try {
            console.log('🔄 Nettoyage des anciennes commandes...');
            
            // ÉTAPE 1: Nettoyer les commandes globales (pour éviter les doublons)
            await rest.put(
                Routes.applicationCommands(this.client.user.id),
                { body: [] }
            );
            console.log('✅ Commandes globales supprimées');
            
            // ÉTAPE 2: Déterminer la guild cible (TOUJOURS utiliser guildId principal)
            const targetGuildId = this.config.guildId; // Forcer l'utilisation de la guild principale
            
            if (!targetGuildId) {
                console.error('❌ GUILD_ID manquant dans la configuration');
                return;
            }
            
            // ÉTAPE 3: Nettoyer les autres guilds si configurées
            if (this.config.staffGuildId && this.config.staffGuildId !== targetGuildId) {
                await rest.put(
                    Routes.applicationGuildCommands(this.client.user.id, this.config.staffGuildId),
                    { body: [] }
                );
                console.log(`✅ Commandes supprimées de la guild staff: ${this.config.staffGuildId}`);
            }
            
            if (this.config.communityGuildId && this.config.communityGuildId !== targetGuildId) {
                await rest.put(
                    Routes.applicationGuildCommands(this.client.user.id, this.config.communityGuildId),
                    { body: [] }
                );
                console.log(`✅ Commandes supprimées de la guild community: ${this.config.communityGuildId}`);
            }
            
            // ÉTAPE 4: Enregistrer les nouvelles commandes sur la guild principale UNIQUEMENT
            await rest.put(
                Routes.applicationGuildCommands(this.client.user.id, targetGuildId),
                { body: commands }
            );
            
            console.log(`✅ ${commands.length} commandes slash enregistrées sur la guild principale: ${targetGuildId}`);
            console.log('📋 Commandes enregistrées:', commands.map(cmd => cmd.name).join(', '));
            
        } catch (error) {
            console.error('❌ Erreur enregistrement commandes slash:', error);
        }
    }

    /**
     * Méthode utilitaire pour forcer le nettoyage complet des commandes
     */
    async cleanAllCommands() {
        const rest = new REST().setToken(this.config.discordToken);
        
        try {
            console.log('🧹 Nettoyage complet de toutes les commandes...');
            
            // Supprimer les commandes globales
            await rest.put(Routes.applicationCommands(this.client.user.id), { body: [] });
            
            // Supprimer de toutes les guilds configurées
            const guildsToClean = [
                this.config.guildId,
                this.config.staffGuildId,
                this.config.communityGuildId
            ].filter(Boolean); // Enlever les valeurs null/undefined
            
            for (const guildId of guildsToClean) {
                await rest.put(
                    Routes.applicationGuildCommands(this.client.user.id, guildId),
                    { body: [] }
                );
                console.log(`✅ Commandes supprimées de la guild: ${guildId}`);
            }
            
            console.log('✅ Nettoyage complet terminé');
            
        } catch (error) {
            console.error('❌ Erreur nettoyage commandes:', error);
        }
    }
}

module.exports = CommandHandler;