/**
 * Welcome System - Système de bienvenue pour le serveur Discord
 * Envoie des messages personnalisés quand un utilisateur rejoint le serveur
 */

require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActivityType, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage, registerFont } = require('canvas');

console.log('👋 Bot Welcome System démarré...');
console.log('📁 Répertoire de travail:', process.cwd());

// === VÉRIFICATION CONFIGURATION ===
console.log('🔍 Vérification des variables d\'environnement:');
const requiredVars = ['DISCORD_TOKEN', 'GUILD_ID', 'WELCOME_CHANNEL_ID'];
const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
    console.error('❌ Variables manquantes:', missingVars.join(', '));
    console.warn('⚠️ Le système de bienvenue pourrait ne pas fonctionner correctement');
}

const config = {
    discordToken: process.env.DISCORD_TOKEN,
    guildId: process.env.GUILD_ID,
    welcomeChannelId: process.env.WELCOME_CHANNEL_ID || null,
    defaultRoleId: process.env.DEFAULT_ROLE_ID || null
};

console.log('⚙️ Configuration chargée:');
console.log(`   - Guild ID: ${config.guildId}`);
console.log(`   - Salon bienvenue: ${config.welcomeChannelId || 'Non configuré'}`);
console.log(`   - Rôle par défaut: ${config.defaultRoleId || 'Non configuré'}`);

// === SYSTÈME DE STOCKAGE ===
const WELCOME_DATA_DIR = path.join(__dirname, 'welcomeData');
const WELCOME_CONFIG_FILE = path.join(WELCOME_DATA_DIR, 'config.json');
const WELCOME_MESSAGES_FILE = path.join(WELCOME_DATA_DIR, 'messages.json');
const WELCOME_LOGS_FILE = path.join(WELCOME_DATA_DIR, 'logs.json');

// Créer le dossier de données s'il n'existe pas
if (!fs.existsSync(WELCOME_DATA_DIR)) {
    fs.mkdirSync(WELCOME_DATA_DIR, { recursive: true });
    console.log(`📁 Dossier créé: ${WELCOME_DATA_DIR}`);
}

// Fonction pour charger les données JSON
function loadJsonFile(filePath, defaultValue = {}) {
    try {
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, JSON.stringify(defaultValue), 'utf8');
            return defaultValue;
        }
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`❌ Erreur chargement ${filePath}:`, error.message);
        return defaultValue;
    }
}

// Fonction pour sauvegarder les données JSON
function saveJsonFile(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error(`❌ Erreur sauvegarde ${filePath}:`, error.message);
        return false;
    }
}

// === CLIENT DISCORD ===
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages
    ]
});

// === SYSTÈME DE BIENVENUE ===
class WelcomeSystem {
    constructor(discordClient) {
        this.client = discordClient;
        this.welcomeChannelId = config.welcomeChannelId;
        this.defaultRoleId = config.defaultRoleId;
        
        // Charger la configuration et les messages
        this.config = loadJsonFile(WELCOME_CONFIG_FILE, {
            enabled: true,
            sendDM: true,
            sendImage: true,
            addDefaultRole: !!this.defaultRoleId,
            imageSettings: {
                background: 'default',
                textColor: '#FFFFFF',
                shadowColor: '#000000'
            }
        });
        
        this.messages = loadJsonFile(WELCOME_MESSAGES_FILE, {
            channel: [
                "Bienvenue {user} sur notre serveur! 👋",
                "Tout le monde, accueillez chaleureusement {user}! 🎉",
                "{user} vient de nous rejoindre. Faites du bruit! 🥳",
                "Un nouvel aventurier {user} est arrivé! ⚔️",
                "{user} vient de débarquer. On t'attendait! 🚀"
            ],
            dm: [
                "Bienvenue sur le serveur {server}! N'hésite pas à te présenter et à lire les règles.",
                "Content de t'accueillir sur {server}! Si tu as des questions, n'hésite pas à demander à un modérateur.",
                "Merci de nous avoir rejoints! Amuse-toi bien sur {server}!"
            ]
        });
        
        this.logs = loadJsonFile(WELCOME_LOGS_FILE, []);
        
        console.log('👋 Système de bienvenue initialisé');
        console.log(`   - Statut: ${this.config.enabled ? 'Activé ✅' : 'Désactivé ❌'}`);
        console.log(`   - Messages de bienvenue: ${this.messages.channel.length}`);
        console.log(`   - Messages privés: ${this.messages.dm.length}`);
    }
    
    // Génère une image de bienvenue avec Canvas
    async generateWelcomeImage(member) {
        try {
            // Créer un canvas de 1024x500 pixels
            const canvas = createCanvas(1024, 500);
            const ctx = canvas.getContext('2d');
            
            // Charger et dessiner le fond
            const background = await loadImage('./welcomeData/backgrounds/default.png').catch(() => {
                // Image par défaut si le fond personnalisé n'existe pas
                return loadImage('https://i.imgur.com/8BmNouD.jpg');
            });
            
            ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
            
            // Ajouter un effet de dégradé pour une meilleure lisibilité du texte
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Dessiner un cercle pour l'avatar
            ctx.beginPath();
            ctx.arc(512, 166, 128, 0, Math.PI * 2);
            ctx.closePath();
            ctx.fillStyle = '#FFFFFF';
            ctx.fill();
            
            // Charger et dessiner l'avatar de l'utilisateur
            const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 1024 });
            const avatar = await loadImage(avatarURL);
            
            ctx.save();
            ctx.beginPath();
            ctx.arc(512, 166, 125, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(avatar, 512 - 125, 166 - 125, 250, 250);
            ctx.restore();
            
            // Configurer le texte
            ctx.font = 'bold 60px Sans-serif';
            ctx.fillStyle = this.config.imageSettings.textColor;
            ctx.textAlign = 'center';
            
            // Ajouter une ombre au texte pour meilleure lisibilité
            ctx.shadowOffsetX = 3;
            ctx.shadowOffsetY = 3;
            ctx.shadowColor = this.config.imageSettings.shadowColor;
            ctx.shadowBlur = 10;
            
            // Dessiner le texte de bienvenue
            ctx.fillText('BIENVENUE', 512, 355);
            
            // Dessiner le nom d'utilisateur
            ctx.font = 'bold 70px Sans-serif';
            
            // Ajuster la taille du texte si le nom est trop long
            const maxWidth = 900;
            let username = member.displayName;
            let fontSize = 70;
            
            ctx.font = `bold ${fontSize}px Sans-serif`;
            while (ctx.measureText(username).width > maxWidth && fontSize > 30) {
                fontSize -= 5;
                ctx.font = `bold ${fontSize}px Sans-serif`;
            }
            
            ctx.fillText(username, 512, 430);
            
            // Créer un buffer à partir du canvas
            const buffer = canvas.toBuffer();
            return new AttachmentBuilder(buffer, { name: 'welcome.png' });
            
        } catch (error) {
            console.error('❌ Erreur lors de la génération de l\'image de bienvenue:', error);
            return null;
        }
    }
    
    // Sélectionne un message aléatoire
    getRandomMessage(type) {
        const messages = type === 'dm' ? this.messages.dm : this.messages.channel;
        const randomIndex = Math.floor(Math.random() * messages.length);
        return messages[randomIndex];
    }
    
    // Traite les variables dans un message
    processMessage(message, member, guild) {
        return message
            .replace(/{user}/g, member.toString())
            .replace(/{username}/g, member.user.username)
            .replace(/{displayname}/g, member.displayName)
            .replace(/{server}/g, guild.name)
            .replace(/{membercount}/g, guild.memberCount);
    }
    
    // Envoie un message de bienvenue
    async sendWelcomeMessage(member) {
        if (!this.config.enabled) return;
        
        try {
            const guild = member.guild;
            
            // 1. Message dans le salon de bienvenue
            if (this.welcomeChannelId) {
                const welcomeChannel = this.client.channels.cache.get(this.welcomeChannelId);
                
                if (welcomeChannel) {
                    const channelMessage = this.getRandomMessage('channel');
                    const processedMessage = this.processMessage(channelMessage, member, guild);
                    
                    const embed = new EmbedBuilder()
                        .setColor('#2ECC71')
                        .setTitle(`👋 Nouveau membre!`)
                        .setDescription(processedMessage)
                        .setTimestamp()
                        .setFooter({ text: `Nous sommes maintenant ${guild.memberCount} membres!` });
                    
                    if (member.user.avatarURL()) {
                        embed.setThumbnail(member.user.avatarURL({ dynamic: true }));
                    }
                    
                    // Si l'option d'image est activée, générer l'image
                    if (this.config.sendImage) {
                        const welcomeImage = await this.generateWelcomeImage(member);
                        
                        if (welcomeImage) {
                            await welcomeChannel.send({ 
                                content: `Bienvenue ${member}!`,
                                embeds: [embed],
                                files: [welcomeImage]
                            });
                        } else {
                            await welcomeChannel.send({ embeds: [embed] });
                        }
                    } else {
                        await welcomeChannel.send({ embeds: [embed] });
                    }
                    
                    console.log(`👋 Message de bienvenue envoyé pour ${member.user.tag} dans #${welcomeChannel.name}`);
                } else {
                    console.log(`❌ Salon de bienvenue introuvable: ${this.welcomeChannelId}`);
                }
            }
            
            // 2. Message privé à l'utilisateur
            if (this.config.sendDM) {
                try {
                    const dmMessage = this.getRandomMessage('dm');
                    const processedDM = this.processMessage(dmMessage, member, guild);
                    
                    const dmEmbed = new EmbedBuilder()
                        .setColor('#3498DB')
                        .setTitle(`Bienvenue sur ${guild.name}!`)
                        .setDescription(processedDM)
                        .setImage(guild.bannerURL({ size: 1024 }) || null)
                        .setTimestamp();
                    
                    await member.send({ embeds: [dmEmbed] });
                    console.log(`📩 Message privé de bienvenue envoyé à ${member.user.tag}`);
                } catch (dmError) {
                    console.log(`⚠️ Impossible d'envoyer un MP à ${member.user.tag}: ${dmError.message}`);
                }
            }
            
            // 3. Ajout du rôle par défaut
            if (this.config.addDefaultRole && this.defaultRoleId) {
                try {
                    await member.roles.add(this.defaultRoleId);
                    console.log(`🏷️ Rôle par défaut ajouté à ${member.user.tag}`);
                } catch (roleError) {
                    console.log(`❌ Impossible d'ajouter le rôle par défaut à ${member.user.tag}: ${roleError.message}`);
                }
            }
            
            // Enregistrer dans les logs
            this.logs.push({
                userId: member.id,
                username: member.user.tag,
                timestamp: new Date().toISOString(),
                action: 'join'
            });
            
            if (this.logs.length > 100) {
                this.logs = this.logs.slice(-100); // Garder seulement les 100 derniers logs
            }
            
            saveJsonFile(WELCOME_LOGS_FILE, this.logs);
            
        } catch (error) {
            console.error(`❌ Erreur lors de l'envoi du message de bienvenue:`, error.message);
        }
    }
    
    // Ajouter un nouveau message de bienvenue
    addWelcomeMessage(type, message) {
        if (type !== 'channel' && type !== 'dm') {
            return false;
        }
        
        this.messages[type].push(message);
        saveJsonFile(WELCOME_MESSAGES_FILE, this.messages);
        return true;
    }
    
    // Supprimer un message de bienvenue
    removeWelcomeMessage(type, index) {
        if (type !== 'channel' && type !== 'dm' || 
            !this.messages[type] || 
            index < 0 || 
            index >= this.messages[type].length) {
            return false;
        }
        
        this.messages[type].splice(index, 1);
        saveJsonFile(WELCOME_MESSAGES_FILE, this.messages);
        return true;
    }
    
    // Activer/désactiver le système de bienvenue
    toggleWelcomeSystem(enabled) {
        this.config.enabled = enabled;
        saveJsonFile(WELCOME_CONFIG_FILE, this.config);
        return this.config.enabled;
    }
    
    // Mettre à jour les paramètres
    updateSettings(settings) {
        this.config = { ...this.config, ...settings };
        saveJsonFile(WELCOME_CONFIG_FILE, this.config);
        return this.config;
    }
}

// Initialiser le système de bienvenue
let welcomeSystem;

// === ÉVÉNEMENTS DISCORD ===
client.once('ready', async () => {
    console.log(`✅ Bot connecté: ${client.user.tag}`);
    
    // Initialiser le système de bienvenue
    welcomeSystem = new WelcomeSystem(client);
    
    // Définir l'activité du bot
    client.user.setActivity('les nouveaux membres', { type: ActivityType.Watching });
    
    // Vérifier les autorisations dans le salon de bienvenue
    if (welcomeSystem.welcomeChannelId) {
        const channel = client.channels.cache.get(welcomeSystem.welcomeChannelId);
        if (channel) {
            const permissions = channel.permissionsFor(client.user);
            if (!permissions.has('SendMessages')) {
                console.warn(`⚠️ Le bot n'a pas l'autorisation d'envoyer des messages dans le salon de bienvenue (#${channel.name})`);
            }
            if (!permissions.has('EmbedLinks')) {
                console.warn(`⚠️ Le bot n'a pas l'autorisation d'intégrer des liens dans le salon de bienvenue (#${channel.name})`);
            }
            if (!permissions.has('AttachFiles')) {
                console.warn(`⚠️ Le bot n'a pas l'autorisation d'attacher des fichiers dans le salon de bienvenue (#${channel.name})`);
            }
        }
    }
    
    // Enregistrer les commandes slash pour la gestion du système de bienvenue
    const commands = [
        {
            name: 'welcome',
            description: 'Commandes du système de bienvenue',
            options: [
                {
                    name: 'toggle',
                    description: 'Activer ou désactiver le système de bienvenue',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'enabled',
                            description: 'État du système',
                            type: 5, // BOOLEAN
                            required: true
                        }
                    ]
                },
                {
                    name: 'add',
                    description: 'Ajouter un message de bienvenue',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'type',
                            description: 'Type de message',
                            type: 3, // STRING
                            required: true,
                            choices: [
                                { name: 'Canal de bienvenue', value: 'channel' },
                                { name: 'Message privé', value: 'dm' }
                            ]
                        },
                        {
                            name: 'message',
                            description: 'Contenu du message',
                            type: 3, // STRING
                            required: true
                        }
                    ]
                },
                {
                    name: 'list',
                    description: 'Lister tous les messages de bienvenue',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'type',
                            description: 'Type de message',
                            type: 3, // STRING
                            required: true,
                            choices: [
                                { name: 'Canal de bienvenue', value: 'channel' },
                                { name: 'Message privé', value: 'dm' }
                            ]
                        }
                    ]
                },
                {
                    name: 'remove',
                    description: 'Supprimer un message de bienvenue',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'type',
                            description: 'Type de message',
                            type: 3, // STRING
                            required: true,
                            choices: [
                                { name: 'Canal de bienvenue', value: 'channel' },
                                { name: 'Message privé', value: 'dm' }
                            ]
                        },
                        {
                            name: 'index',
                            description: 'Index du message à supprimer (commencez par 1)',
                            type: 4, // INTEGER
                            required: true
                        }
                    ]
                },
                {
                    name: 'settings',
                    description: 'Modifier les paramètres du système de bienvenue',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'send_dm',
                            description: 'Envoyer un message privé aux nouveaux membres',
                            type: 5, // BOOLEAN
                            required: false
                        },
                        {
                            name: 'send_image',
                            description: 'Envoyer une image de bienvenue',
                            type: 5, // BOOLEAN
                            required: false
                        },
                        {
                            name: 'add_role',
                            description: 'Ajouter automatiquement le rôle par défaut',
                            type: 5, // BOOLEAN
                            required: false
                        }
                    ]
                },
                {
                    name: 'test',
                    description: 'Tester le message de bienvenue',
                    type: 1, // SUB_COMMAND
                }
            ]
        }
    ];
    
    try {
        console.log('🔄 Enregistrement des commandes du système de bienvenue...');
        await client.application.commands.set(commands, config.guildId);
        console.log('✅ Commandes de bienvenue enregistrées');
    } catch (error) {
        console.error('❌ Erreur enregistrement commandes:', error.message);
    }
});

// Événement quand un membre rejoint le serveur
client.on('guildMemberAdd', async (member) => {
    if (welcomeSystem && member.guild.id === config.guildId) {
        console.log(`👤 Nouvel utilisateur: ${member.user.tag}`);
        await welcomeSystem.sendWelcomeMessage(member);
    }
});

// Gestion des commandes slash
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    
    if (interaction.commandName === 'welcome') {
        // Vérifier les permissions (admin ou gérer le serveur)
        if (!interaction.member.permissions.has('Administrator') && 
            !interaction.member.permissions.has('ManageGuild')) {
            await interaction.reply({ 
                content: '❌ Vous n\'avez pas la permission d\'utiliser cette commande.', 
                ephemeral: true 
            });
            return;
        }
        
        const subcommand = interaction.options.getSubcommand();
        
        try {
            switch (subcommand) {
                case 'toggle': {
                    const enabled = interaction.options.getBoolean('enabled');
                    welcomeSystem.toggleWelcomeSystem(enabled);
                    await interaction.reply({ 
                        content: `✅ Le système de bienvenue est maintenant ${enabled ? 'activé' : 'désactivé'}.`, 
                        ephemeral: true 
                    });
                    break;
                }
                
                case 'add': {
                    const type = interaction.options.getString('type');
                    const message = interaction.options.getString('message');
                    
                    welcomeSystem.addWelcomeMessage(type, message);
                    
                    await interaction.reply({ 
                        content: `✅ Message de bienvenue ajouté (${type === 'channel' ? 'canal' : 'MP'}).`,
                        ephemeral: true 
                    });
                    break;
                }
                
                case 'list': {
                    const type = interaction.options.getString('type');
                    const messages = welcomeSystem.messages[type];
                    
                    if (!messages || messages.length === 0) {
                        await interaction.reply({ 
                            content: `❌ Aucun message de bienvenue de type "${type}".`,
                            ephemeral: true 
                        });
                        return;
                    }
                    
                    const messageList = messages
                        .map((msg, i) => `**${i + 1}.** ${msg}`)
                        .join('\n\n');
                    
                    const embed = new EmbedBuilder()
                        .setTitle(`Messages de bienvenue (${type === 'channel' ? 'Canal' : 'MP'})`)
                        .setDescription(messageList)
                        .setColor('#3498DB')
                        .setFooter({ text: `Total: ${messages.length} messages` });
                    
                    await interaction.reply({ 
                        embeds: [embed],
                        ephemeral: true 
                    });
                    break;
                }
                
                case 'remove': {
                    const type = interaction.options.getString('type');
                    const index = interaction.options.getInteger('index') - 1; // Convertir à 0-index
                    
                    if (welcomeSystem.removeWelcomeMessage(type, index)) {
                        await interaction.reply({ 
                            content: `✅ Message de bienvenue supprimé.`,
                            ephemeral: true 
                        });
                    } else {
                        await interaction.reply({ 
                            content: `❌ Impossible de supprimer le message. Vérifiez l'index.`,
                            ephemeral: true 
                        });
                    }
                    break;
                }
                
                case 'settings': {
                    const settings = {};
                    
                    const sendDM = interaction.options.getBoolean('send_dm');
                    if (sendDM !== null) settings.sendDM = sendDM;
                    
                    const sendImage = interaction.options.getBoolean('send_image');
                    if (sendImage !== null) settings.sendImage = sendImage;
                    
                    const addRole = interaction.options.getBoolean('add_role');
                    if (addRole !== null) settings.addDefaultRole = addRole;
                    
                    welcomeSystem.updateSettings(settings);
                    
                    const currentSettings = welcomeSystem.config;
                    
                    const embed = new EmbedBuilder()
                        .setTitle('⚙️ Paramètres du système de bienvenue')
                        .setDescription('Paramètres mis à jour avec succès!')
                        .addFields(
                            { name: 'Système activé', value: currentSettings.enabled ? '✅' : '❌', inline: true },
                            { name: 'Messages privés', value: currentSettings.sendDM ? '✅' : '❌', inline: true },
                            { name: 'Images de bienvenue', value: currentSettings.sendImage ? '✅' : '❌', inline: true },
                            { name: 'Ajout rôle automatique', value: currentSettings.addDefaultRole ? '✅' : '❌', inline: true }
                        )
                        .setColor('#2ECC71');
                    
                    await interaction.reply({ 
                        embeds: [embed],
                        ephemeral: true 
                    });
                    break;
                }
                
                case 'test': {
                    // Simuler un message de bienvenue pour l'utilisateur qui a exécuté la commande
                    await welcomeSystem.sendWelcomeMessage(interaction.member);
                    
                    await interaction.reply({ 
                        content: '✅ Test du message de bienvenue envoyé!',
                        ephemeral: true 
                    });
                    break;
                }
            }
        } catch (error) {
            console.error('❌ Erreur lors de l\'exécution de la commande welcome:', error);
            await interaction.reply({ 
                content: `❌ Une erreur s'est produite: ${error.message}`,
                ephemeral: true 
            });
        }
    }
});

// === GESTION DES ERREURS ===
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Promesse non gérée rejetée:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Exception non capturée:', error);
});

// === DÉMARRAGE DU BOT ===
client.login(config.discordToken).catch(error => {
    console.error('❌ Erreur connexion Discord:', error.message);
    process.exit(1);
});
