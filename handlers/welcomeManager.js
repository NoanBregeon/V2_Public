const { EmbedBuilder } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

class WelcomeManager {
    constructor(client, config) {
        this.client = client;
        this.config = config;
        this.enabled = true;
        this.welcomeMessages = [];
        this.leaveMessages = [];
        this.dataPath = path.join(__dirname, '../data/welcome.json');
    }

    async initialize() {
        // Pas d'événements ici - ils sont gérés dans index.js
        await this.loadData();
        console.log('✅ WelcomeManager initialisé');
    }

    async handleMemberJoin(member) {
        if (!this.enabled) return;
        if (member.user.bot) return;
        
        try {
            // DÉSACTIVER l'embed de bienvenue avec commandes
            // await this.sendWelcomeMessage(member);
            
            // Garder seulement l'attribution du rôle
            await this.assignDefaultRole(member);
            
            console.log(`✅ Nouveau membre traité sans embed: ${member.user.tag}`);
        } catch (error) {
            console.error('❌ Erreur gestion nouveau membre:', error);
        }
    }

    async handleMemberLeave(member) {
        if (!this.enabled) return;
        if (member.user.bot) return;
        
        try {
            // DÉSACTIVER l'embed de départ
            // await this.sendLeaveMessage(member);
            
            console.log(`👋 Membre parti (sans embed): ${member.user.tag}`);
        } catch (error) {
            console.error('❌ Erreur gestion départ membre:', error);
        }
    }

    async sendWelcomeMessage(member) {
        const welcomeChannelId = this.config.welcomeChannelId;
        if (!welcomeChannelId) return;
        
        try {
            const welcomeChannel = await this.client.channels.fetch(welcomeChannelId);
            if (!welcomeChannel) return;
            
            // Utiliser un message aléatoire parmi ceux disponibles
            let message;
            if (this.welcomeMessages.length > 0) {
                const randomIndex = Math.floor(Math.random() * this.welcomeMessages.length);
                message = this.welcomeMessages[randomIndex];
            } else {
                message = 'Bienvenue {user} sur le serveur {guild_name} !';
            }
            
            // Remplacer les variables
            message = message
                .replace('{user}', member.toString())
                .replace('{user_tag}', member.user.tag)
                .replace('{user_name}', member.user.username)
                .replace('{guild_name}', member.guild.name)
                .replace('{member_count}', member.guild.memberCount.toString());
            
            // Si c'est un embed structuré (commence par "{" et finit par "}")
            if (message.startsWith('{') && message.endsWith('}')) {
                try {
                    const embedData = JSON.parse(message);
                    const embed = this.createWelcomeEmbed(member, embedData);
                    await welcomeChannel.send({ embeds: [embed] });
                } catch {
                    await welcomeChannel.send(message);
                }
            } else {
                // Message texte simple
                await welcomeChannel.send(message);
            }
            
        } catch (error) {
            console.error('❌ Erreur envoi message bienvenue:', error);
        }
    }

    async sendLeaveMessage(member) {
        const welcomeChannelId = this.config.welcomeChannelId;
        if (!welcomeChannelId) return;
        
        try {
            const welcomeChannel = await this.client.channels.fetch(welcomeChannelId);
            if (!welcomeChannel) return;
            
            // Utiliser un message aléatoire parmi ceux disponibles
            let message;
            if (this.leaveMessages.length > 0) {
                const randomIndex = Math.floor(Math.random() * this.leaveMessages.length);
                message = this.leaveMessages[randomIndex];
            } else {
                message = 'Au revoir {user_tag}, merci d\'avoir visité {guild_name} !';
            }
            
            // Remplacer les variables
            message = message
                .replace('{user_tag}', member.user.tag)
                .replace('{user_name}', member.user.username)
                .replace('{guild_name}', member.guild.name)
                .replace('{member_count}', member.guild.memberCount.toString());
            
            // Envoyer le message
            await welcomeChannel.send(message);
            
        } catch (error) {
            console.error('❌ Erreur envoi message départ:', error);
        }
    }

    async assignDefaultRole(member) {
        if (!this.config.defaultRoleId) return;
        
        try {
            const role = await member.guild.roles.fetch(this.config.defaultRoleId);
            if (role) {
                await member.roles.add(role);
                console.log(`✅ Rôle par défaut attribué à ${member.user.tag}`);
            }
        } catch (error) {
            console.error('❌ Erreur attribution rôle par défaut:', error);
        }
    }

    createWelcomeEmbed(member, data = {}) {
        // Valeurs par défaut
        const defaults = {
            title: `Bienvenue sur ${member.guild.name}!`,
            description: `Salut ${member}, bienvenue sur notre serveur!`,
            color: 0x3498DB, // Bleu
            thumbnail: member.user.displayAvatarURL(),
            timestamp: true
        };
        
        // Fusion avec les données personnalisées
        const options = { ...defaults, ...data };
        
        // Créer l'embed
        const embed = new EmbedBuilder()
            .setTitle(options.title)
            .setDescription(options.description)
            .setColor(options.color);
            
        // Ajout conditionnel des autres éléments
        if (options.thumbnail) {
            embed.setThumbnail(options.thumbnail);
        }
        
        if (options.footer) {
            embed.setFooter({ 
                text: options.footer.text || `${member.guild.name}`, 
                iconURL: options.footer.iconURL || member.guild.iconURL() 
            });
        }
        
        if (options.timestamp) {
            embed.setTimestamp();
        }
        
        if (options.fields && Array.isArray(options.fields)) {
            for (const field of options.fields) {
                embed.addFields({
                    name: field.name,
                    value: field.value,
                    inline: field.inline !== undefined ? field.inline : false
                });
            }
        }
        
        return embed;
    }

    async loadData() {
        try {
            const data = await fs.readFile(this.dataPath, 'utf8');
            const parsed = JSON.parse(data);
            
            this.enabled = parsed.enabled !== undefined ? parsed.enabled : true;
            this.welcomeMessages = parsed.welcomeMessages || [];
            this.leaveMessages = parsed.leaveMessages || [];
            
            console.log(`📝 Données de bienvenue chargées: ${this.welcomeMessages.length} messages d'arrivée, ${this.leaveMessages.length} messages de départ`);
        } catch (error) {
            // Si le fichier n'existe pas, le créer avec des valeurs par défaut
            if (error.code === 'ENOENT') {
                await this.saveData();
            } else {
                console.error('❌ Erreur chargement données bienvenue:', error);
            }
        }
    }

    async saveData() {
        try {
            const dir = path.dirname(this.dataPath);
            await fs.mkdir(dir, { recursive: true });
            
            const data = {
                enabled: this.enabled,
                welcomeMessages: this.welcomeMessages,
                leaveMessages: this.leaveMessages
            };
            
            await fs.writeFile(this.dataPath, JSON.stringify(data, null, 2));
            console.log('📝 Données de bienvenue sauvegardées');
        } catch (error) {
            console.error('❌ Erreur sauvegarde données bienvenue:', error);
        }
    }

    async handleSlashCommand(interaction, subcommand) {
        switch (subcommand) {
            case 'toggle':
                return this.handleToggle(interaction);
            case 'add':
                return this.handleAdd(interaction);
            case 'remove':
                return this.handleRemove(interaction);
            case 'test':
                return this.handleTest(interaction);
            default:
                return interaction.reply({ content: '❌ Sous-commande inconnue', ephemeral: true });
        }
    }

    async handleToggle(interaction) {
        const enable = interaction.options.getBoolean('activer');
        
        this.enabled = enable;
        await this.saveData();
        
        return interaction.reply({ 
            content: `✅ Système de bienvenue ${enable ? 'activé' : 'désactivé'}.`,
            ephemeral: true
        });
    }

    async handleAdd(interaction) {
        const type = interaction.options.getString('type');
        const message = interaction.options.getString('message');
        
        if (type === 'join') {
            this.welcomeMessages.push(message);
        } else if (type === 'leave') {
            this.leaveMessages.push(message);
        }
        
        await this.saveData();
        
        return interaction.reply({ 
            content: `✅ Message de ${type === 'join' ? 'bienvenue' : 'départ'} ajouté.`,
            ephemeral: true
        });
    }

    async handleRemove(interaction) {
        const type = interaction.options.getString('type');
        
        if (type === 'join') {
            this.welcomeMessages = [];
        } else if (type === 'leave') {
            this.leaveMessages = [];
        }
        
        await this.saveData();
        
        return interaction.reply({ 
            content: `✅ Tous les messages de ${type === 'join' ? 'bienvenue' : 'départ'} ont été supprimés.`,
            ephemeral: true
        });
    }

    async handleTest(interaction) {
        try {
            // Simuler un message de bienvenue pour le membre qui exécute la commande
            if (this.welcomeMessages.length > 0) {
                await this.sendWelcomeMessage(interaction.member);
            } else {
                const embed = new EmbedBuilder()
                    .setTitle('👋 Test bienvenue')
                    .setDescription(`Bienvenue ${interaction.user} sur ${interaction.guild.name}!`)
                    .setColor(0x3498DB)
                    .setThumbnail(interaction.user.displayAvatarURL())
                    .setTimestamp();
                
                const welcomeChannelId = this.config.welcomeChannelId;
                if (welcomeChannelId) {
                    const welcomeChannel = await this.client.channels.fetch(welcomeChannelId);
                    if (welcomeChannel) {
                        await welcomeChannel.send({ embeds: [embed] });
                    }
                }
            }
            
            return interaction.reply({ 
                content: `✅ Message de test envoyé${this.config.welcomeChannelId ? ` dans <#${this.config.welcomeChannelId}>` : ''}.`,
                ephemeral: true
            });
            
        } catch (error) {
            console.error('❌ Erreur test bienvenue:', error);
            return interaction.reply({ 
                content: '❌ Erreur lors de l\'envoi du message de test.',
                ephemeral: true
            });
        }
    }
}

module.exports = WelcomeManager;
