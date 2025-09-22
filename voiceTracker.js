/**
 * VoiceTracker - Système de surveillance des salons vocaux pour Discord
 * Permet de suivre le temps passé par les utilisateurs dans les salons vocaux
 */

require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ApplicationCommandOptionType, ActivityType } = require('discord.js');
const fs = require('fs');
const path = require('path');

console.log('🎙️ Bot Voice Tracker démarré...');
console.log('📁 Répertoire de travail:', process.cwd());

// === VÉRIFICATION CONFIGURATION ===
console.log('🔍 Vérification des variables d\'environnement:');
const requiredVars = ['DISCORD_TOKEN', 'GUILD_ID', 'VOICE_LOGS_CHANNEL_ID'];
const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
    console.error('❌ Variables manquantes:', missingVars.join(', '));
    process.exit(1);
}

const config = {
    discordToken: process.env.DISCORD_TOKEN,
    guildId: process.env.GUILD_ID,
    voiceLogsChannelId: process.env.VOICE_LOGS_CHANNEL_ID,
    createVoiceChannelId: process.env.CREATE_VOICE_CHANNEL_ID || null,
    voiceInstructionsChannelId: process.env.VOICE_INSTRUCTIONS_CHANNEL_ID || null,
};

console.log('⚙️ Configuration chargée:');
console.log(`   - Guild ID: ${config.guildId}`);
console.log(`   - Salon logs vocaux: ${config.voiceLogsChannelId}`);
console.log(`   - Salon création vocaux: ${config.createVoiceChannelId || 'Non configuré'}`);
console.log(`   - Salon instructions vocaux: ${config.voiceInstructionsChannelId || 'Non configuré'}`);

// === SYSTÈME DE STOCKAGE ===
const VOICE_STATS_DIR = path.join(__dirname, 'voiceData');
const DAILY_STATS_FILE = path.join(VOICE_STATS_DIR, 'dailyStats.json');
const MONTHLY_STATS_FILE = path.join(VOICE_STATS_DIR, 'monthlyStats.json');
const SESSION_HISTORY_FILE = path.join(VOICE_STATS_DIR, 'sessionHistory.json');
const TEMP_CHANNELS_FILE = path.join(VOICE_STATS_DIR, 'tempChannels.json');

// Créer le dossier de données s'il n'existe pas
if (!fs.existsSync(VOICE_STATS_DIR)) {
    fs.mkdirSync(VOICE_STATS_DIR, { recursive: true });
    console.log(`📁 Dossier créé: ${VOICE_STATS_DIR}`);
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
        GatewayIntentBits.GuildVoiceStates
    ]
});

// === SYSTÈME DE TRACKING VOCAL ===
class VoiceTracker {
    constructor(discordClient) {
        this.client = discordClient;
        this.voiceLogsChannelId = config.voiceLogsChannelId;
        this.voiceSessions = new Map(); // userId -> { joinTime, channelName, channelId }
        this.dailyVoiceStats = new Map(Object.entries(loadJsonFile(DAILY_STATS_FILE)));
        this.monthlyVoiceStats = new Map(Object.entries(loadJsonFile(MONTHLY_STATS_FILE)));
        this.sessionHistory = loadJsonFile(SESSION_HISTORY_FILE, []);
        this.tempChannels = new Map(Object.entries(loadJsonFile(TEMP_CHANNELS_FILE, {})));
        
        console.log('🎙️ Système de tracking vocal initialisé');
        console.log(`   - Sessions actives: 0`);
        console.log(`   - Utilisateurs trackés (jour): ${this.dailyVoiceStats.size}`);
        console.log(`   - Utilisateurs trackés (mois): ${this.monthlyVoiceStats.size}`);
        console.log(`   - Historique des sessions: ${this.sessionHistory.length} enregistrements`);
        console.log(`   - Salons temporaires: ${this.tempChannels.size}`);
    }

    formatDuration(milliseconds) {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        if (hours > 0) {
            return `${hours}h ${minutes}min ${seconds}s`;
        } else if (minutes > 0) {
            return `${minutes}min ${seconds}s`;
        } else {
            return `${seconds}s`;
        }
    }

    async handleVoiceJoin(member, channel) {
        const userId = member.id;
        const joinTime = Date.now();
        
        // Enregistrer la session
        this.voiceSessions.set(userId, {
            joinTime,
            channelName: channel.name,
            channelId: channel.id,
            username: member.displayName || member.user.username,
            userTag: member.user.tag,
            userId: userId
        });

        console.log(`🎙️ ${member.displayName} a rejoint le salon vocal "${channel.name}"`);

        // Log de connexion
        await this.sendVoiceLog({
            type: 'join',
            user: member,
            channel,
            timestamp: joinTime
        });

        // Sauvegarder les données
        this.saveData();
    }

    async handleVoiceLeave(member, channel, sessionDuration = null) {
        const userId = member.id;
        const leaveTime = Date.now();
        
        // Récupérer les données de session
        const session = this.voiceSessions.get(userId);
        if (!session) {
            console.log(`⚠️ Aucune session trouvée pour ${member.displayName}`);
            return;
        }

        // Calculer la durée
        const duration = sessionDuration || (leaveTime - session.joinTime);
        const durationText = this.formatDuration(duration);
        
        // Supprimer la session
        this.voiceSessions.delete(userId);

        // Ajouter au total journalier et mensuel
        const minutesSpent = Math.floor(duration / 1000 / 60);
        if (minutesSpent > 0) { // Ignorer les sessions trop courtes (< 1 min)
            // Stats journalières
            const currentDaily = this.dailyVoiceStats.get(userId) || 0;
            this.dailyVoiceStats.set(userId, currentDaily + minutesSpent);
            
            // Stats mensuelles
            const currentMonthly = this.monthlyVoiceStats.get(userId) || 0;
            this.monthlyVoiceStats.set(userId, currentMonthly + minutesSpent);
            
            // Ajouter à l'historique des sessions
            this.sessionHistory.push({
                userId,
                username: member.displayName,
                userTag: member.user.tag,
                channelId: channel.id,
                channelName: channel.name,
                joinTime: session.joinTime,
                leaveTime,
                duration: duration,
                durationMinutes: minutesSpent,
                date: new Date().toISOString()
            });
            
            // Limiter l'historique à 1000 entrées
            if (this.sessionHistory.length > 1000) {
                this.sessionHistory = this.sessionHistory.slice(-1000);
            }
        }

        console.log(`🎙️ ${member.displayName} a quitté le salon vocal "${channel.name}" après ${durationText}`);

        // Log de déconnexion avec durée
        await this.sendVoiceLog({
            type: 'leave',
            user: member,
            channel,
            timestamp: leaveTime,
            joinTime: session.joinTime,
            duration,
            durationText,
            dailyTotal: Math.floor((this.dailyVoiceStats.get(userId) || 0))
        });

        // Sauvegarder les données
        this.saveData();
        
        // Supprimer le salon temporaire s'il est vide
        if (this.tempChannels.has(channel.id)) {
            try {
                // Vérifier si le salon est vide
                if (channel.members.size === 0) {
                    console.log(`🗑️ Suppression du salon temporaire vide: ${channel.name}`);
                    await channel.delete('Salon temporaire vide');
                    this.tempChannels.delete(channel.id);
                    this.saveData();
                }
            } catch (error) {
                console.error(`❌ Erreur suppression salon temporaire:`, error.message);
            }
        }
    }

    async handleVoiceMove(member, oldChannel, newChannel) {
        const userId = member.id;
        const moveTime = Date.now();
        
        // Si l'utilisateur était dans un salon, terminer cette session
        const session = this.voiceSessions.get(userId);
        if (session && oldChannel) {
            const duration = moveTime - session.joinTime;
            await this.handleVoiceLeave(member, oldChannel, duration);
        }

        // Commencer une nouvelle session dans le nouveau salon
        if (newChannel) {
            await this.handleVoiceJoin(member, newChannel);
        }

        // Log de déplacement
        await this.sendVoiceLog({
            type: 'move',
            user: member,
            oldChannel,
            newChannel,
            timestamp: moveTime
        });
    }

    async handleCreateTempChannel(member, channel) {
        try {
            if (!config.createVoiceChannelId) return;
            if (channel.id !== config.createVoiceChannelId) return;

            // L'utilisateur a rejoint le salon de création
            const guild = member.guild;
            const category = channel.parent;
            
            // Créer un salon temporaire
            const tempChannelName = `🔊 Salon de ${member.displayName}`;
            const tempChannel = await guild.channels.create({
                name: tempChannelName,
                type: 2, // Voice channel
                parent: category ? category.id : null,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        allow: ['Connect', 'Speak', 'Stream']
                    },
                    {
                        id: member.id,
                        allow: ['Connect', 'Speak', 'Stream', 'MuteMembers', 'DeafenMembers', 'ManageChannels']
                    }
                ]
            });

            console.log(`✅ Salon temporaire créé: ${tempChannelName}`);
            
            // Enregistrer le salon temporaire
            this.tempChannels.set(tempChannel.id, {
                creatorId: member.id,
                creatorName: member.displayName,
                createdAt: Date.now()
            });
            
            // Déplacer l'utilisateur dans son salon
            await member.voice.setChannel(tempChannel);
            
            // Envoyer un message dans le salon d'instructions si configuré
            if (config.voiceInstructionsChannelId) {
                const instructChannel = guild.channels.cache.get(config.voiceInstructionsChannelId);
                if (instructChannel) {
                    const embed = new EmbedBuilder()
                        .setColor(0x00FF00)
                        .setTitle('🎙️ Salon temporaire créé')
                        .setDescription(`**${member.displayName}** a créé un salon vocal temporaire`)
                        .addFields(
                            { name: '👤 Créateur', value: member.toString(), inline: true },
                            { name: '🎙️ Salon', value: `<#${tempChannel.id}>`, inline: true },
                            { name: '⚙️ Permissions', value: 'Vous pouvez gérer votre salon: renommer, expulser des membres, etc.', inline: false }
                        )
                        .setTimestamp()
                        .setFooter({ text: 'Le salon sera supprimé quand il sera vide' });
                    
                    await instructChannel.send({ content: member.toString(), embeds: [embed] });
                }
            }
            
            // Log
            await this.sendVoiceLog({
                type: 'create',
                user: member,
                channel: tempChannel,
                timestamp: Date.now()
            });
            
            // Sauvegarder les données
            this.saveData();
        } catch (error) {
            console.error('❌ Erreur création salon temporaire:', error.message);
        }
    }

    async sendVoiceLog(logData) {
        try {
            if (!this.voiceLogsChannelId) {
                console.log('⚠️ VOICE_LOGS_CHANNEL_ID non configuré, skip du log vocal');
                return;
            }

            const logChannel = this.client.channels.cache.get(this.voiceLogsChannelId);
            if (!logChannel) {
                console.log(`❌ Salon de logs vocal non trouvé: ${this.voiceLogsChannelId}`);
                return;
            }

            const { type, user, channel, oldChannel, newChannel, timestamp, joinTime, duration, durationText, dailyTotal } = logData;
            
            let embed;
            
            switch (type) {
                case 'join':
                    embed = new EmbedBuilder()
                        .setColor(0x00FF00)
                        .setTitle('🎙️ Connexion Vocal')
                        .setDescription(`**${user.displayName}** a rejoint un salon vocal`)
                        .addFields(
                            { name: '👤 Utilisateur', value: `${user.displayName} (${user.user.tag})`, inline: true },
                            { name: '🎙️ Salon', value: `#${channel.name}`, inline: true },
                            { name: '⏰ Heure de connexion', value: `<t:${Math.floor(timestamp / 1000)}:F>`, inline: false }
                        )
                        .setTimestamp()
                        .setFooter({ text: 'Logs Vocal • Connexion' });
                    break;

                case 'leave':
                    embed = new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle('🎙️ Déconnexion Vocal')
                        .setDescription(`**${user.displayName}** a quitté un salon vocal`)
                        .addFields(
                            { name: '👤 Utilisateur', value: `${user.displayName} (${user.user.tag})`, inline: true },
                            { name: '🎙️ Salon', value: `#${channel.name}`, inline: true },
                            { name: '⏰ Connecté à', value: `<t:${Math.floor(joinTime / 1000)}:T>`, inline: true },
                            { name: '⏰ Déconnecté à', value: `<t:${Math.floor(timestamp / 1000)}:T>`, inline: true },
                            { name: '⏱️ Durée de session', value: `**${durationText}**`, inline: true },
                            { name: '📊 Total aujourd\'hui', value: `**${dailyTotal} minute(s)**`, inline: true }
                        )
                        .setTimestamp()
                        .setFooter({ text: 'Logs Vocal • Déconnexion' });
                    break;

                case 'move':
                    embed = new EmbedBuilder()
                        .setColor(0xFFAA00)
                        .setTitle('🎙️ Déplacement Vocal')
                        .setDescription(`**${user.displayName}** a changé de salon vocal`)
                        .addFields(
                            { name: '👤 Utilisateur', value: `${user.displayName} (${user.user.tag})`, inline: true },
                            { name: '📤 Ancien salon', value: oldChannel ? `#${oldChannel.name}` : 'Aucun', inline: true },
                            { name: '📥 Nouveau salon', value: newChannel ? `#${newChannel.name}` : 'Aucun', inline: true },
                            { name: '⏰ Heure', value: `<t:${Math.floor(timestamp / 1000)}:F>`, inline: false }
                        )
                        .setTimestamp()
                        .setFooter({ text: 'Logs Vocal • Déplacement' });
                    break;

                case 'create':
                    embed = new EmbedBuilder()
                        .setColor(0x00FFFF)
                        .setTitle('🎙️ Création Salon Vocal')
                        .setDescription(`**${user.displayName}** a créé un salon vocal temporaire`)
                        .addFields(
                            { name: '👤 Créateur', value: `${user.displayName} (${user.user.tag})`, inline: true },
                            { name: '🎙️ Salon créé', value: `#${channel.name}`, inline: true },
                            { name: '⏰ Heure de création', value: `<t:${Math.floor(timestamp / 1000)}:F>`, inline: false }
                        )
                        .setTimestamp()
                        .setFooter({ text: 'Logs Vocal • Création Salon' });
                    break;
            }

            await logChannel.send({ embeds: [embed] });
            console.log(`📋 Log vocal envoyé: ${type} pour ${user.displayName}`);

        } catch (error) {
            console.error('❌ Erreur envoi log vocal:', error.message);
        }
    }

    // Obtenir les stats vocales d'un utilisateur
    getUserVoiceStats(userId) {
        const session = this.voiceSessions.get(userId);
        const dailyTotal = this.dailyVoiceStats.get(userId) || 0;
        const monthlyTotal = this.monthlyVoiceStats.get(userId) || 0;
        
        return {
            isInVoice: !!session,
            currentSession: session,
            dailyTotal,
            monthlyTotal,
            history: this.sessionHistory.filter(s => s.userId === userId).slice(-5)
        };
    }

    // Sauvegarder toutes les données
    saveData() {
        // Convertir les Maps en objets pour les stocker
        const dailyStats = Object.fromEntries(this.dailyVoiceStats);
        const monthlyStats = Object.fromEntries(this.monthlyVoiceStats);
        const tempChannels = Object.fromEntries(this.tempChannels);

        // Sauvegarder les données
        saveJsonFile(DAILY_STATS_FILE, dailyStats);
        saveJsonFile(MONTHLY_STATS_FILE, monthlyStats);
        saveJsonFile(SESSION_HISTORY_FILE, this.sessionHistory);
        saveJsonFile(TEMP_CHANNELS_FILE, tempChannels);
    }

    // Réinitialiser les stats journalières (à minuit)
    resetDailyStats() {
        this.dailyVoiceStats.clear();
        this.saveData();
        console.log('🔄 Stats vocales journalières réinitialisées');
    }

    // Réinitialiser les stats mensuelles (le 1er du mois)
    resetMonthlyStats() {
        this.monthlyVoiceStats.clear();
        this.saveData();
        console.log('🔄 Stats vocales mensuelles réinitialisées');
    }
}

// Initialiser le tracker vocal
let voiceTracker;

// === ÉVÉNEMENTS DISCORD ===
client.once('ready', async () => {
    console.log(`✅ Bot connecté: ${client.user.tag}`);
    
    // Initialiser le tracker vocal
    voiceTracker = new VoiceTracker(client);
    
    // Définir l'activité du bot
    client.user.setActivity('vos temps vocaux', { type: ActivityType.Watching });
    
    // Enregistrer les commandes slash
    const commands = [
        {
            name: 'voicestats',
            description: 'Afficher les statistiques vocales d\'un utilisateur',
            options: [
                { 
                    name: 'user', 
                    description: 'Utilisateur Discord (optionnel)', 
                    type: ApplicationCommandOptionType.User, 
                    required: false 
                }
            ]
        },
        {
            name: 'voiceleaderboard',
            description: 'Afficher le classement du temps vocal',
            options: [
                {
                    name: 'period',
                    description: 'Période (jour ou mois)',
                    type: ApplicationCommandOptionType.String,
                    required: false,
                    choices: [
                        { name: 'Aujourd\'hui', value: 'daily' },
                        { name: 'Ce mois', value: 'monthly' }
                    ]
                }
            ]
        },
        {
            name: 'voicehistory',
            description: 'Afficher l\'historique des sessions vocales d\'un utilisateur',
            options: [
                { 
                    name: 'user', 
                    description: 'Utilisateur Discord (optionnel)', 
                    type: ApplicationCommandOptionType.User, 
                    required: false 
                },
                {
                    name: 'limit',
                    description: 'Nombre de sessions à afficher (5 par défaut, max 20)',
                    type: ApplicationCommandOptionType.Integer,
                    required: false
                }
            ]
        },
        {
            name: 'voicereset',
            description: 'Réinitialiser les stats vocales (admin seulement)',
            options: [
                {
                    name: 'type',
                    description: 'Type de statistiques à réinitialiser',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                        { name: 'Journalières', value: 'daily' },
                        { name: 'Mensuelles', value: 'monthly' },
                        { name: 'Tout', value: 'all' }
                    ]
                }
            ]
        }
    ];
    
    try {
        console.log('🔄 Enregistrement des commandes vocales...');
        await client.application.commands.set(commands, config.guildId);
        console.log('✅ Commandes vocales enregistrées');
    } catch (error) {
        console.error('❌ Erreur enregistrement commandes:', error.message);
    }
    
    // Planifier la réinitialisation des stats
    scheduleResets();
});

// === ÉVÉNEMENTS SALONS VOCAUX ===
client.on('voiceStateUpdate', async (oldState, newState) => {
    if (!voiceTracker) return;
    
    const member = newState.member;
    if (!member) return;
    
    const oldChannel = oldState.channel;
    const newChannel = newState.channel;
    
    // Ignorer les bots
    if (member.user.bot) return;
    
    try {
        // Gérer la création de salon temporaire
        if (newChannel && newChannel.id === config.createVoiceChannelId) {
            await voiceTracker.handleCreateTempChannel(member, newChannel);
            return; // La suite sera gérée après le déplacement vers le nouveau salon
        }
        
        if (!oldChannel && newChannel) {
            // Utilisateur rejoint un salon vocal
            await voiceTracker.handleVoiceJoin(member, newChannel);
        } else if (oldChannel && !newChannel) {
            // Utilisateur quitte un salon vocal
            await voiceTracker.handleVoiceLeave(member, oldChannel);
        } else if (oldChannel && newChannel && oldChannel.id !== newChannel.id) {
            // Utilisateur change de salon vocal
            await voiceTracker.handleVoiceMove(member, oldChannel, newChannel);
        }
        // Ignorer les autres changements (mute/deafen, etc.)
    } catch (error) {
        console.error('❌ Erreur gestion événement vocal:', error.message);
    }
});

// === GESTION DES COMMANDES SLASH ===
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    
    const { commandName, options } = interaction;
    
    // Ne gérer que les commandes liées à la voix
    if (!commandName.startsWith('voice')) return;
    
    try {
        await interaction.deferReply();
        
        switch (commandName) {
            case 'voicestats': {
                const targetUser = options.getUser('user') || interaction.user;
                const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
                
                if (!member) {
                    await interaction.editReply('❌ Utilisateur introuvable.');
                    return;
                }
                
                const stats = voiceTracker.getUserVoiceStats(targetUser.id);
                
                let statusText = '';
                if (stats.isInVoice) {
                    const currentDuration = Date.now() - stats.currentSession.joinTime;
                    const channel = interaction.guild.channels.cache.get(stats.currentSession.channelId);
                    statusText = `🎙️ **Actuellement connecté**\n` +
                               `📍 Salon: ${channel ? `<#${channel.id}>` : stats.currentSession.channelName}\n` +
                               `⏱️ Durée actuelle: ${voiceTracker.formatDuration(currentDuration)}\n\n`;
                }
                
                // Formater les temps
                const dailyHours = Math.floor(stats.dailyTotal / 60);
                const dailyMinutes = stats.dailyTotal % 60;
                const dailyFormatted = dailyHours > 0 ? 
                    `${dailyHours}h ${dailyMinutes}min` : 
                    `${dailyMinutes}min`;
                
                const monthlyHours = Math.floor(stats.monthlyTotal / 60);
                const monthlyMinutes = stats.monthlyTotal % 60;
                const monthlyFormatted = monthlyHours > 0 ? 
                    `${monthlyHours}h ${monthlyMinutes}min` : 
                    `${monthlyMinutes}min`;
                
                const embed = new EmbedBuilder()
                    .setColor(0x00AAFF)
                    .setTitle(`🎙️ Statistiques Vocales: ${member.displayName}`)
                    .setDescription(`${statusText}Statistiques de temps passé dans les salons vocaux`)
                    .addFields(
                        { name: '📊 Aujourd\'hui', value: `**${dailyFormatted}**`, inline: true },
                        { name: '📈 Ce mois', value: `**${monthlyFormatted}**`, inline: true },
                        { name: '\u200B', value: '\u200B', inline: true },
                    )
                    .setThumbnail(targetUser.displayAvatarURL())
                    .setTimestamp()
                    .setFooter({ text: 'Voice Tracker • Stats Vocales' });
                
                // Ajouter l'historique si disponible
                if (stats.history && stats.history.length > 0) {
                    const historyText = stats.history
                        .sort((a, b) => b.leaveTime - a.leaveTime)
                        .map(session => {
                            const date = new Date(session.leaveTime);
                            const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
                            return `• ${formattedDate}: **${voiceTracker.formatDuration(session.duration)}** dans **${session.channelName}**`;
                        })
                        .join('\n');
                    
                    embed.addFields({ name: '🕒 Dernières Sessions', value: historyText, inline: false });
                }
                
                await interaction.editReply({ embeds: [embed] });
                break;
            }
            
            case 'voiceleaderboard': {
                const period = options.getString('period') || 'daily';
                const stats = period === 'daily' ? 
                    voiceTracker.dailyVoiceStats : 
                    voiceTracker.monthlyVoiceStats;
                
                const sortedStats = Array.from(stats.entries())
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 10);
                
                if (sortedStats.length === 0) {
                    await interaction.editReply(`Aucune activité vocale ${period === 'daily' ? 'aujourd\'hui' : 'ce mois-ci'}.`);
                    return;
                }
                
                let leaderboard = '';
                const medals = ['🥇', '🥈', '🥉'];
                
                for (let i = 0; i < sortedStats.length; i++) {
                    const [userId, minutes] = sortedStats[i];
                    try {
                        const member = await interaction.guild.members.fetch(userId);
                        const rank = i < 3 ? medals[i] : `${i+1}.`;
                        
                        // Formater le temps
                        let timeFormatted;
                        if (minutes >= 60) {
                            const hours = Math.floor(minutes / 60);
                            const mins = minutes % 60;
                            timeFormatted = `${hours}h ${mins}min`;
                        } else {
                            timeFormatted = `${minutes}min`;
                        }
                        
                        leaderboard += `${rank} **${member.displayName}** — ${timeFormatted}\n`;
                    } catch (error) {
                        leaderboard += `${i+1}. Utilisateur inconnu — ${minutes} minute(s)\n`;
                    }
                }
                
                const embed = new EmbedBuilder()
                    .setColor(0xFFD700)
                    .setTitle(`🏆 Classement Temps Vocal ${period === 'daily' ? 'Aujourd\'hui' : 'Ce Mois'}`)
                    .setDescription(leaderboard)
                    .setTimestamp()
                    .setFooter({ text: 'Voice Tracker • Classement Vocal' });
                
                await interaction.editReply({ embeds: [embed] });
                break;
            }
            
            case 'voicehistory': {
                const targetUser = options.getUser('user') || interaction.user;
                const limit = Math.min(options.getInteger('limit') || 5, 20); // Maximum 20 entrées
                
                const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
                if (!member) {
                    await interaction.editReply('❌ Utilisateur introuvable.');
                    return;
                }
                
                const history = voiceTracker.sessionHistory
                    .filter(session => session.userId === targetUser.id)
                    .sort((a, b) => b.leaveTime - a.leaveTime)
                    .slice(0, limit);
                
                if (history.length === 0) {
                    await interaction.editReply(`Aucun historique vocal disponible pour ${member.displayName}.`);
                    return;
                }
                
                const historyText = history.map((session, index) => {
                    const date = new Date(session.leaveTime);
                    const formattedDate = `<t:${Math.floor(session.leaveTime / 1000)}:f>`;
                    const duration = voiceTracker.formatDuration(session.duration);
                    return `**${index + 1}.** ${formattedDate}\n📍 **${session.channelName}** pendant **${duration}**`;
                }).join('\n\n');
                
                const embed = new EmbedBuilder()
                    .setColor(0x00AAFF)
                    .setTitle(`🕒 Historique Vocal: ${member.displayName}`)
                    .setDescription(historyText)
                    .setThumbnail(targetUser.displayAvatarURL())
                    .setTimestamp()
                    .setFooter({ text: `Voice Tracker • ${history.length} session(s) affichée(s)` });
                
                await interaction.editReply({ embeds: [embed] });
                break;
            }
            
            case 'voicereset': {
                // Vérifier les permissions (admin seulement)
                if (!interaction.member.permissions.has('Administrator')) {
                    await interaction.editReply('❌ Vous devez être administrateur pour utiliser cette commande.');
                    return;
                }
                
                const resetType = options.getString('type');
                
                switch (resetType) {
                    case 'daily':
                        voiceTracker.resetDailyStats();
                        await interaction.editReply('✅ Statistiques vocales journalières réinitialisées!');
                        break;
                    
                    case 'monthly':
                        voiceTracker.resetMonthlyStats();
                        await interaction.editReply('✅ Statistiques vocales mensuelles réinitialisées!');
                        break;
                    
                    case 'all':
                        voiceTracker.resetDailyStats();
                        voiceTracker.resetMonthlyStats();
                        await interaction.editReply('✅ Toutes les statistiques vocales ont été réinitialisées!');
                        break;
                }
                break;
            }
        }
    } catch (error) {
        console.error(`❌ Erreur commande ${commandName}:`, error.message);
        try {
            await interaction.editReply(`❌ Une erreur s'est produite: ${error.message}`);
        } catch (e) {
            console.error('Impossible de répondre:', e.message);
        }
    }
});

// === PLANIFICATION RÉINITIALISATION STATS ===
function scheduleResets() {
    // Planifier la réinitialisation journalière (à minuit)
    const scheduleDailyReset = () => {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        
        const msUntilMidnight = tomorrow - now;
        
        setTimeout(() => {
            if (voiceTracker) {
                voiceTracker.resetDailyStats();
            }
            scheduleDailyReset(); // Re-planifier pour le jour suivant
        }, msUntilMidnight);
        
        console.log(`⏰ Réinitialisation des stats vocales journalières programmée dans ${Math.floor(msUntilMidnight / 1000 / 60)} minutes`);
    };
    
    // Planifier la réinitialisation mensuelle (le 1er du mois)
    const scheduleMonthlyReset = () => {
        const now = new Date();
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 5, 0, 0);
        const msUntilNextMonth = nextMonth - now;
        
        setTimeout(() => {
            if (voiceTracker) {
                voiceTracker.resetMonthlyStats();
            }
            scheduleMonthlyReset(); // Re-planifier pour le mois suivant
        }, msUntilNextMonth);
        
        console.log(`📅 Réinitialisation des stats vocales mensuelles programmée dans ${Math.floor(msUntilNextMonth / 1000 / 60 / 60 / 24)} jours`);
    };
    
    // Démarrer les planifications
    scheduleDailyReset();
    scheduleMonthlyReset();
}

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
