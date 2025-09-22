/**
 * Module de tracking vocal
 * Surveille les activités dans les salons vocaux
 */

const { EmbedBuilder, ApplicationCommandOptionType } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Classe principale du module
class VoiceTracker {
    constructor(client) {
        this.client = client;
        this.voiceLogsChannelId = process.env.VOICE_LOGS_CHANNEL_ID;
        this.createVoiceChannelId = process.env.CREATE_VOICE_CHANNEL_ID;
        this.voiceSessions = new Map(); // userId -> { joinTime, channelName, channelId }
        this.dailyVoiceStats = new Map();
        this.monthlyVoiceStats = new Map();
        this.sessionHistory = [];
        this.tempChannels = new Map();
        
        // Créer les dossiers de données
        this.dataDir = path.join(__dirname, '../data/voice');
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
        
        this.DAILY_STATS_FILE = path.join(this.dataDir, 'dailyStats.json');
        this.MONTHLY_STATS_FILE = path.join(this.dataDir, 'monthlyStats.json');
        this.SESSION_HISTORY_FILE = path.join(this.dataDir, 'sessionHistory.json');
        this.TEMP_CHANNELS_FILE = path.join(this.dataDir, 'tempChannels.json');
        
        // Charger les données
        this.loadData();
        
        console.log('🎙️ Module Voice Tracker initialisé');
    }
    
    // Charger les données depuis les fichiers
    loadData() {
        try {
            // Charger les stats journalières
            if (fs.existsSync(this.DAILY_STATS_FILE)) {
                const data = JSON.parse(fs.readFileSync(this.DAILY_STATS_FILE, 'utf8'));
                this.dailyVoiceStats = new Map(Object.entries(data));
            }
            
            // Charger les stats mensuelles
            if (fs.existsSync(this.MONTHLY_STATS_FILE)) {
                const data = JSON.parse(fs.readFileSync(this.MONTHLY_STATS_FILE, 'utf8'));
                this.monthlyVoiceStats = new Map(Object.entries(data));
            }
            
            // Charger l'historique des sessions
            if (fs.existsSync(this.SESSION_HISTORY_FILE)) {
                this.sessionHistory = JSON.parse(fs.readFileSync(this.SESSION_HISTORY_FILE, 'utf8'));
            }
            
            // Charger les salons temporaires
            if (fs.existsSync(this.TEMP_CHANNELS_FILE)) {
                const data = JSON.parse(fs.readFileSync(this.TEMP_CHANNELS_FILE, 'utf8'));
                this.tempChannels = new Map(Object.entries(data));
            }
            
            console.log('📊 Données vocales chargées:');
            console.log(`   - Stats journalières: ${this.dailyVoiceStats.size} utilisateurs`);
            console.log(`   - Stats mensuelles: ${this.monthlyVoiceStats.size} utilisateurs`);
            console.log(`   - Historique: ${this.sessionHistory.length} sessions`);
            console.log(`   - Salons temporaires: ${this.tempChannels.size} salons`);
        } catch (error) {
            console.error('❌ Erreur lors du chargement des données vocales:', error);
        }
    }
    
    // Sauvegarder les données dans les fichiers
    saveData() {
        try {
            // Convertir les Maps en objets pour les stocker
            const dailyStats = Object.fromEntries(this.dailyVoiceStats);
            const monthlyStats = Object.fromEntries(this.monthlyVoiceStats);
            const tempChannels = Object.fromEntries(this.tempChannels);
            
            // Sauvegarder les données
            fs.writeFileSync(this.DAILY_STATS_FILE, JSON.stringify(dailyStats, null, 2), 'utf8');
            fs.writeFileSync(this.MONTHLY_STATS_FILE, JSON.stringify(monthlyStats, null, 2), 'utf8');
            fs.writeFileSync(this.SESSION_HISTORY_FILE, JSON.stringify(this.sessionHistory.slice(-1000), null, 2), 'utf8');
            fs.writeFileSync(this.TEMP_CHANNELS_FILE, JSON.stringify(tempChannels, null, 2), 'utf8');
        } catch (error) {
            console.error('❌ Erreur lors de la sauvegarde des données vocales:', error);
        }
    }
    
    // Formatage de la durée
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
    
    // === GESTION DES ÉVÉNEMENTS VOCAUX ===
    
    // Quand un utilisateur rejoint un salon vocal
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
            userId
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
    
    // Quand un utilisateur quitte un salon vocal
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
    
    // Quand un utilisateur change de salon vocal
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
    
    // Gérer la création de salon temporaire
    async handleCreateTempChannel(member, channel) {
        try {
            if (!this.createVoiceChannelId || channel.id !== this.createVoiceChannelId) return;

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
    
    // Envoyer un log vocal
    async sendVoiceLog(logData) {
        try {
            if (!this.voiceLogsChannelId) {
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

        } catch (error) {
            console.error('❌ Erreur envoi log vocal:', error.message);
        }
    }
    
    // Planifier la réinitialisation des stats
    scheduleResets() {
        // Réinitialisation journalière (à minuit)
        const scheduleDailyReset = () => {
            const now = new Date();
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);
            
            const msUntilMidnight = tomorrow - now;
            
            setTimeout(() => {
                this.dailyVoiceStats.clear();
                this.saveData();
                console.log('🔄 Stats vocales journalières réinitialisées');
                scheduleDailyReset();
            }, msUntilMidnight);
            
            console.log(`⏰ Réinitialisation des stats vocales journalières programmée dans ${Math.floor(msUntilMidnight / 1000 / 60)} minutes`);
        };
        
        // Réinitialisation mensuelle (le 1er du mois)
        const scheduleMonthlyReset = () => {
            const now = new Date();
            const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 5, 0, 0);
            const msUntilNextMonth = nextMonth - now;
            
            setTimeout(() => {
                this.monthlyVoiceStats.clear();
                this.saveData();
                console.log('🔄 Stats vocales mensuelles réinitialisées');
                scheduleMonthlyReset();
            }, msUntilNextMonth);
            
            console.log(`📅 Réinitialisation des stats vocales mensuelles programmée dans ${Math.floor(msUntilNextMonth / 1000 / 60 / 60 / 24)} jours`);
        };
        
        // Démarrer les planifications
        scheduleDailyReset();
        scheduleMonthlyReset();
    }
    
    // Commandes liées au module vocal
    registerCommands(client) {
        // Liste des commandes du module
        return [
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
            }
        ];
    }
    
    // Gestionnaire de commandes liées au module vocal
    async handleCommand(interaction) {
        if (!interaction.isChatInputCommand()) return false;
        
        const { commandName, options } = interaction;
        
        // Ne traiter que les commandes qui commencent par "voice"
        if (!commandName.startsWith('voice')) return false;
        
        try {
            switch (commandName) {
                case 'voicestats': {
                    const targetUser = options.getUser('user') || interaction.user;
                    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
                    
                    if (!member) {
                        await interaction.reply('❌ Utilisateur introuvable.');
                        return true;
                    }
                    
                    // Obtenir les statistiques
                    const userId = targetUser.id;
                    const session = this.voiceSessions.get(userId);
                    const dailyTotal = this.dailyVoiceStats.get(userId) || 0;
                    const monthlyTotal = this.monthlyVoiceStats.get(userId) || 0;
                    
                    // Vérifier si l'utilisateur est actuellement dans un salon vocal
                    let statusText = '';
                    if (session) {
                        const currentDuration = Date.now() - session.joinTime;
                        const channel = interaction.guild.channels.cache.get(session.channelId);
                        statusText = `🎙️ **Actuellement connecté**\n` +
                                   `📍 Salon: ${channel ? `<#${channel.id}>` : session.channelName}\n` +
                                   `⏱️ Durée actuelle: ${this.formatDuration(currentDuration)}\n\n`;
                    }
                    
                    // Formater les temps
                    const dailyHours = Math.floor(dailyTotal / 60);
                    const dailyMinutes = dailyTotal % 60;
                    const dailyFormatted = dailyHours > 0 ? 
                        `${dailyHours}h ${dailyMinutes}min` : 
                        `${dailyMinutes}min`;
                    
                    const monthlyHours = Math.floor(monthlyTotal / 60);
                    const monthlyMinutes = monthlyTotal % 60;
                    const monthlyFormatted = monthlyHours > 0 ? 
                        `${monthlyHours}h ${monthlyMinutes}min` : 
                        `${monthlyMinutes}min`;
                    
                    // Récupérer l'historique récent des sessions
                    const history = this.sessionHistory
                        .filter(s => s.userId === userId)
                        .sort((a, b) => b.leaveTime - a.leaveTime)
                        .slice(0, 5);
                    
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
                    if (history.length > 0) {
                        const historyText = history
                            .map(session => {
                                const date = new Date(session.leaveTime);
                                const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
                                return `• ${formattedDate}: **${this.formatDuration(session.duration)}** dans **${session.channelName}**`;
                            })
                            .join('\n');
                        
                        embed.addFields({ name: '🕒 Dernières Sessions', value: historyText, inline: false });
                    }
                    
                    await interaction.reply({ embeds: [embed] });
                    return true;
                }
                
                case 'voiceleaderboard': {
                    const period = options.getString('period') || 'daily';
                    const stats = period === 'daily' ? 
                        this.dailyVoiceStats : 
                        this.monthlyVoiceStats;
                    
                    const sortedStats = Array.from(stats.entries())
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 10);
                    
                    if (sortedStats.length === 0) {
                        await interaction.reply(`Aucune activité vocale ${period === 'daily' ? 'aujourd\'hui' : 'ce mois-ci'}.`);
                        return true;
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
                    
                    await interaction.reply({ embeds: [embed] });
                    return true;
                }
                
                default:
                    return false;
            }
        } catch (error) {
            console.error(`❌ Erreur commande ${commandName}:`, error.message);
            try {
                await interaction.reply(`❌ Une erreur s'est produite: ${error.message}`);
            } catch (replyError) {
                console.error('Impossible de répondre:', replyError.message);
            }
            return true;
        }
    }
}

// Méthode d'initialisation du module (appelée par le gestionnaire de modules)
module.exports.initialize = async (client) => {
    // Créer l'instance du tracker vocal
    const voiceTracker = new VoiceTracker(client);
    
    // Écouter les événements vocaux
    client.on('voiceStateUpdate', async (oldState, newState) => {
        const member = newState.member;
        if (!member || member.user.bot) return; // Ignorer les bots
        
        try {
            const oldChannel = oldState.channel;
            const newChannel = newState.channel;
            
            // Gérer la création de salon temporaire
            if (newChannel && newChannel.id === voiceTracker.createVoiceChannelId) {
                await voiceTracker.handleCreateTempChannel(member, newChannel);
                return;
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
        } catch (error) {
            console.error('❌ Erreur gestion événement vocal:', error.message);
        }
    });
    
    // Écouter les commandes
    client.on('interactionCreate', async (interaction) => {
        if (interaction.isCommand()) {
            await voiceTracker.handleCommand(interaction);
        }
    });
    
    // Planifier la réinitialisation des stats
    voiceTracker.scheduleResets();
    
    // Retourner l'instance du module
    return voiceTracker;
};
