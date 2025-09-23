const { EmbedBuilder, Collection, PermissionFlagsBits } = require('discord.js');
// Fallback fetch Node < 18 (sécurité)
if (typeof fetch !== 'function') {
    global.fetch = (...args) => import('node-fetch').then(m => m.default(...args));
}

class CommandHandler {
    constructor(client, config) {
        this.client = client;
        this.config = config;
        this.commands = new Collection();
        this.prefix = '!';
    }

    async initialize() {
        this._defineCommands();
        await this._registerSlash();
        console.log('✅ CommandHandler initialisé');
    }

    _defineCommands() {
        const defs = [
            // Modération Twitch uniquement
            ['addmodo','Ajouter un modérateur Twitch',[
                {name:'utilisateur',type:3,description:'Nom d\'utilisateur Twitch',required:true}
            ]],
            ['removemodo','Retirer un modérateur Twitch',[
                {name:'utilisateur',type:3,description:'Nom d\'utilisateur Twitch',required:true}
            ]],
            ['addvip','Ajouter un VIP Twitch',[
                {name:'utilisateur',type:3,description:'Nom d\'utilisateur Twitch',required:true}
            ]],
            ['removevip','Retirer un VIP Twitch',[
                {name:'utilisateur',type:3,description:'Nom d\'utilisateur Twitch',required:true}
            ]],
            ['ban','Bannir un utilisateur',[
                {name:'utilisateur',type:6,description:'Utilisateur',required:true},
                {name:'raison',type:3,description:'Raison',required:false}
            ]],
            ['timeout','Timeout (minutes)',[
                {name:'utilisateur',type:6,description:'Utilisateur',required:true},
                {name:'duree',type:4,description:'Durée en minutes',required:true,min_value:1,max_value:2880},
                {name:'raison',type:3,description:'Raison',required:false}
            ]],
            ['search','Rechercher un utilisateur',[{name:'terme',type:3,description:'Nom ou ID',required:true}]],
            ['listmods','Lister modérateurs',[]],
            ['listvips','Lister VIP',[]],
            ['listbans','Lister bannis',[]],
            ['userinfo','Infos utilisateur',[{name:'utilisateur',type:6,description:'Utilisateur (optionnel)',required:false}]],
            // Vocal
            ['rename','Renommer votre salon',[{name:'nom',type:3,description:'Nouveau nom',required:true}]],
            ['limit','Limiter votre salon',[{name:'nombre',type:4,description:'0 = illimité',required:true,min_value:0,max_value:99}]],
            ['lock','Verrouiller votre salon',[]],
            ['unlock','Déverrouiller votre salon',[]],
            ['transfer','Transférer le salon',[{name:'utilisateur',type:6,description:'Nouveau propriétaire',required:true}]],
            // Info / util
            ['botinfo','Infos bot',[]],
            ['streaminfo','Infos stream',[{name:'streamer',type:3,description:'Streamer',required:false}]],
            ['ping','Latence',[]],
            ['help','Aide',[]],
            ['clear','Supprimer des messages',[{name:'nombre',type:4,description:'1-100',required:true,min_value:1,max_value:100}]],
            ['systemcheck','Vérifier l\'état du système',[]],
            ['testtoken','Tester le token Twitch',[]],
            ['reloadcommands','Recharger les commandes slash',[]],
            // Twitch (gestion Helix)
            ['twitchaddmod','Ajouter modérateur Twitch',[{name:'username',type:3,description:'Pseudo Twitch',required:true}]],
            ['twitchremovemod','Retirer modérateur Twitch',[{name:'username',type:3,description:'Pseudo Twitch',required:true}]],
            ['twitchaddvip','Ajouter VIP Twitch',[{name:'username',type:3,description:'Pseudo Twitch',required:true}]],
            ['twitchremovevip','Retirer VIP Twitch',[{name:'username',type:3,description:'Pseudo Twitch',required:true}]],
            ['twitchban','Ban Twitch (permanent)',[
                {name:'username',type:3,description:'Pseudo Twitch',required:true},
                {name:'reason',type:3,description:'Raison',required:false}
            ]],
            ['twitchunban','Unban Twitch',[{name:'username',type:3,description:'Pseudo Twitch',required:true}]],
            ['twitchtimeout','Timeout Twitch (sec)',[
                {name:'username',type:3,description:'Pseudo Twitch',required:true},
                {name:'duration',type:4,description:'Durée (60-1209600)',required:true,min_value:60,max_value:1209600},
                {name:'reason',type:3,description:'Raison',required:false}
            ]],
            ['twitchlistmods','Lister mods Twitch',[]],
            ['twitchlistvips','Lister VIP Twitch',[]],
            ['twitchlistbans','Lister bans Twitch',[]],
            ['twitchsearch','Rechercher Twitch',[
                {name:'query',type:3,description:'Texte (>=2)',required:true},
                {name:'dans',type:3,description:'Scope (all/mods/vips/bans)',required:false,
                 choices:[
                    {name:'Partout',value:'all'},
                    {name:'Modérateurs',value:'mods'},
                    {name:'VIP',value:'vips'},
                    {name:'Bannis',value:'bans'}
                 ]}
            ]]
        ];
        for (const [name, description, options] of defs) {
            this.commands.set(name, { name, description, options });
        }
    }

    async _registerSlash() {
        const targetGuildId = this.config.staffGuildId || this.config.guildId;
        const guild = this.client.guilds.cache.get(targetGuildId);
        if (!guild) {
            console.warn('⚠️ Guild introuvable pour enregistrer les commandes');
            return;
        }
        await guild.commands.set([...this.commands.values()]);
        console.log(`✅ ${this.commands.size} commandes slash enregistrées sur ${targetGuildId}`);
    }

    async reloadCommands() {
        console.log('🔄 Rechargement des commandes...');
        
        // 1. Redéfinir toutes les commandes
        this.commands.clear();
        this._defineCommands();
        
        // 2. Re-enregistrer sur la guild
        const targetGuildId = this.config.staffGuildId || this.config.guildId;
        const guild = this.client.guilds.cache.get(targetGuildId);
        if (!guild) {
            throw new Error('Guild introuvable pour enregistrer les commandes');
        }
        
        await guild.commands.set([...this.commands.values()]);
        console.log(`✅ ${this.commands.size} commandes slash rechargées sur ${targetGuildId}`);
        
        // 3. Optionnel : enregistrer globalement en fallback
        try {
            await this.client.application.commands.set([...this.commands.values()]);
            console.log(`✅ ${this.commands.size} commandes slash enregistrées globalement (fallback)`);
        } catch (error) {
            console.warn('⚠️ Échec enregistrement global:', error.message);
        }
        
        return this.commands.size;
    }

    async handleInteraction(interaction) {
        if (!interaction.isChatInputCommand()) return;
        const cmd = interaction.commandName;
        const moderation = this.client.moduleManager?.getModule('moderationManager');
        const voice = this.client.moduleManager?.getModule('voiceManager');

        try {
            // Commandes Twitch uniquement (plus de gestion Discord)
            if (['addmodo','removemodo','addvip','removevip'].includes(cmd)) {
                if (!this._twitchApiReady()) {
                    return interaction.reply({ content:'❌ Twitch API non configurée', ephemeral:true });
                }
                
                const twitchUser = interaction.options.getString('twitch') || interaction.options.getString('utilisateur');
                if (!twitchUser) {
                    return interaction.reply({ content:'❌ Veuillez spécifier un nom d\'utilisateur Twitch', ephemeral:true });
                }
                
                await interaction.deferReply();
                const isAdd = cmd.startsWith('add');
                const isMod = cmd.includes('modo');
                
                try {
                    await this._twitchAddRemove(isMod ? 'moderator' : 'vip', isAdd ? 'add' : 'remove', twitchUser);
                    const action = isAdd ? 'ajouté' : 'retiré';
                    const role = isMod ? 'modérateur' : 'VIP';
                    const emoji = isMod ? '🛡️' : '⭐';
                    return interaction.editReply(`${emoji} **${twitchUser}** ${action} comme ${role} sur Twitch`);
                } catch (error) {
                    console.error('❌ Erreur Twitch API:', error);
                    return interaction.editReply(`❌ Erreur lors de la ${isAdd ? 'ajout' : 'suppression'} de ${twitchUser}`);
                }
            }

            const modGroup = ['ban','timeout','search','listmods','listvips','listbans','userinfo',
                // ajout
                'mute','unmute','kick','discordban','unban','warn'
            ];

            if (modGroup.includes(cmd)) {
                if (!moderation) return interaction.reply({ content:'❌ Module modération indisponible', ephemeral:true });
                if (!interaction.deferred && ['search','userinfo','listbans'].includes(cmd))
                    await interaction.deferReply({ ephemeral:true });
                return moderation.handleDiscordModerationCommand(interaction, cmd);
            }

            const voiceGroup = ['rename','limit','lock','unlock','transfer'];
            if (voiceGroup.includes(cmd)) {
                if (!voice) return interaction.reply({ content:'❌ Module vocal indisponible', ephemeral:true });
                return voice.handleSlashCommand(interaction, cmd);
            }

            const twitchGroup = [
                'twitchaddmod','twitchremovemod','twitchaddvip','twitchremovevip',
                'twitchban','twitchunban','twitchtimeout',
                'twitchlistmods','twitchlistvips','twitchlistbans','twitchsearch'
            ];
            if (twitchGroup.includes(cmd)) {
                if (!this._twitchApiReady()) {
                    return interaction.reply({ content:'❌ Twitch API non configurée', ephemeral:true });
                }
                await interaction.deferReply({ ephemeral:true });
                return this._handleTwitchCommand(interaction, cmd);
            }

            switch (cmd) {
                case 'ping': return interaction.reply({ content:`🏓 ${this.client.ws.ping}ms` });
                case 'botinfo': return this._botInfo(interaction);
                case 'streaminfo': return this._streamInfo(interaction);
                case 'help': return this._help(interaction);
                case 'clear': return this._clear(interaction);
                case 'systemcheck': return this._systemCheck(interaction);
                case 'testtoken': return this._testToken(interaction);
                case 'reloadcommands': return this._reloadCommandsSlash(interaction);
                default:
                    return interaction.reply({ content:'❌ Commande inconnue', ephemeral:true });
            }
        } catch (e) {
            console.error('❌ Erreur interaction:', e);
            if (interaction.deferred) return interaction.editReply('❌ Erreur interne');
            if (!interaction.replied) return interaction.reply({ content:'❌ Erreur interne', ephemeral:true });
        }
    }

    async handleMessage(message) {
        if (!message.content.startsWith(this.prefix) || message.author.bot) return;
        const args = message.content.slice(this.prefix.length).trim().split(/\s+/);
        const cmd = args.shift()?.toLowerCase();
        
        // Commande spéciale de rechargement des commandes slash
        if (cmd === 'reloadcommands') {
            // Vérifier les permissions (admin ou owner)
            if (!message.member.permissions.has('Administrator') && message.author.id !== message.guild.ownerId) {
                return message.reply('❌ Vous devez être administrateur pour utiliser cette commande.');
            }
            
            try {
                const reactionMsg = await message.reply('🔄 Rechargement des commandes en cours...');
                const commandCount = await this.reloadCommands();
                await reactionMsg.edit(`✅ ${commandCount} commandes rechargées avec succès !`);
            } catch (error) {
                console.error('❌ Erreur rechargement commandes:', error);
                await message.reply(`❌ Erreur lors du rechargement: ${error.message}`);
            }
            return;
        }
        
        // Commandes vocales existantes
        if (['rename','limit','lock','unlock','transfer'].includes(cmd)) {
            const voice = this.client.moduleManager?.getModule('voiceManager');
            if (voice) return voice.handleTextCommand(message, cmd, args);
        }
    }

    async _botInfo(interaction) {
        await interaction.deferReply(); // Éviter le timeout
        const embed = new EmbedBuilder()
            .setTitle('📊 Bot Info')
            .addFields(
                { name:'Ping', value:`${this.client.ws.ping}ms`, inline:true },
                { name:'Serveur', value:interaction.guild.name, inline:true },
                { name:'Commandes', value:`${this.commands.size}`, inline:true }
            )
            .setColor(0x00FF00)
            .setTimestamp();
        return interaction.editReply({ embeds:[embed] }); // Utiliser editReply après deferReply
    }

    async _streamInfo(interaction) {
        const streamer = interaction.options.getString('streamer') || this.config.streamerUsername || 'inconnu';
        const embed = new EmbedBuilder()
            .setTitle('📺 Stream Info')
            .setDescription(`Streamer: **${streamer}**\nhttps://twitch.tv/${streamer}`)
            .setColor(0x9146FF);
        return interaction.reply({ embeds:[embed] });
    }

    async _help(interaction) {
        await interaction.deferReply(); // Éviter le timeout
        const embed = new EmbedBuilder()
            .setTitle('📋 Liste des commandes du bot')
            .setDescription('Toutes les commandes disponibles organisées par catégorie')
            .addFields(
                {
                    name: '� Modération Twitch',
                    value: [
                        '`/addmodo <utilisateur>` - Ajouter un modérateur Twitch',
                        '`/removemodo <utilisateur>` - Retirer un modérateur Twitch',
                        '`/addvip <utilisateur>` - Ajouter un VIP Twitch',
                        '`/removevip <utilisateur>` - Retirer un VIP Twitch',
                        '`/listmods` - Lister tous les modérateurs Twitch',
                        '`/listvips` - Lister tous les VIP Twitch'
                    ].join('\n')
                },
                {
                    name: '⚔️ Modération Discord - Actions',
                    value: [
                        '`/mute <utilisateur> <durée> [raison]` - Muter un utilisateur',
                        '`/unmute <utilisateur> [raison]` - Démuter un utilisateur',
                        '`/kick <utilisateur> [raison]` - Expulser un utilisateur',
                        '`/discordban <utilisateur> [raison]` - Bannir un utilisateur',
                        '`/unban <userid> [raison]` - Débannir un utilisateur',
                        '`/warn <utilisateur> <raison>` - Avertir un utilisateur'
                    ].join('\n')
                },
                {
                    name: '📊 Modération Discord - Infos',
                    value: [
                        '`/userinfo [utilisateur]` - Infos sur un utilisateur',
                        '`/listbans` - Lister les utilisateurs bannis'
                    ].join('\n')
                },
                {
                    name: '📺 Autres commandes Twitch',
                    value: [
                        '`/twitchban <username> [raison]` - Bannir sur Twitch',
                        '`/twitchtimeout <username> <durée> [raison]` - Timeout sur Twitch',
                        '`/twitchunban <username>` - Débannir sur Twitch',
                        '`/twitchsearch <username>` - Rechercher un utilisateur Twitch'
                    ].join('\n')
                },
                {
                    name: '🎤 Gestion vocale',
                    value: [
                        '`/rename <nom>` - Renommer votre salon vocal',
                        '`/limit <nombre>` - Limiter le nombre d\'utilisateurs (0 = illimité)',
                        '`/lock` - Verrouiller votre salon vocal',
                        '`/unlock` - Déverrouiller votre salon vocal',
                        '`/transfer <utilisateur>` - Transférer la propriété du salon'
                    ].join('\n')
                },
                {
                    name: '👋 Système de bienvenue',
                    value: [
                        '`/welcome toggle <true/false>` - Activer/désactiver le système',
                        '`/welcome add <type> <message>` - Ajouter un message',
                        '`/welcome remove <type>` - Supprimer un message',
                        '`/welcome test` - Tester le message de bienvenue'
                    ].join('\n')
                },
                {
                    name: 'ℹ️ Informations',
                    value: [
                        '`/botinfo` - Informations sur le bot',
                        '`/streaminfo [streamer]` - Informations sur le stream',
                        '`/ping` - Vérifier la latence du bot',
                        '`/help` - Afficher cette aide'
                    ].join('\n')
                },
                {
                    name: '🔧 Utilitaires',
                    value: [
                        '`/clear <nombre>` - Supprimer des messages (1-100)',
                        '`/systemcheck` - Vérifier l\'état de tous les systèmes',
                        '`/testtoken` - Tester la validité du token Twitch',
                        '`/reloadcommands` - Recharger les commandes slash (Admin)',
                        '`!reloadcommands` - Recharger les commandes (version message)'
                    ].join('\n')
                }
            )
            .setColor(0x3498DB);
        return interaction.editReply({ embeds:[embed] }); // Utiliser editReply après deferReply
    }

    async _clear(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages))
            return interaction.reply({ content:'❌ Permission manquante', ephemeral:true });
        const amount = interaction.options.getInteger('nombre');
        try {
            const deleted = await interaction.channel.bulkDelete(amount, true);
            return interaction.reply({ content:`✅ ${deleted.size} messages supprimés`, ephemeral:true });
        } catch (err) {
            console.error('❌ Erreur clear:', err);
            return interaction.reply({ content:'❌ Erreur (messages trop anciens ?)', ephemeral:true });
        }
    }

    async _systemCheck(interaction) {
        await interaction.deferReply({ ephemeral: true }); // Éviter le timeout
        const mods = ['moderationManager','voiceManager','welcomeManager'];
        const embed = new EmbedBuilder().setTitle('🔍 System Check').setColor(0x3498DB);
        for (const m of mods) {
            const ok = this.client.moduleManager?.getModule(m);
            embed.addFields({ name:m, value: ok ? '🟢 OK' : '🔴 Manquant', inline:true });
        }
        // Ajout Twitch
        const twitchBridge = this.client.moduleManager?.getModule('twitchBridge');
        embed.addFields({ name:'twitchBridge', value: twitchBridge?.getStatus?.() || '🔴', inline:true });
        embed.addFields(
            { name:'Ping', value:`${this.client.ws.ping}ms`, inline:true },
            { name:'Guild', value:this.config.guildId ? '🟢' : '🔴', inline:true },
            { name:'Commandes définies', value:`${this.commands.size}`, inline:true },
            { name:'testtoken défini', value: this.commands.has('testtoken') ? '🟢' : '🔴', inline:true }
        );
        return interaction.editReply({ embeds:[embed] }); // Utiliser editReply après deferReply
    }

    async _testToken(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        const twitchBridge = this.client.moduleManager?.getModule('twitchBridge');
        if (!twitchBridge) {
            return interaction.editReply('❌ Module TwitchBridge non disponible');
        }

        try {
            const tokenInfo = await twitchBridge.testTwitchToken();
            
            if (!tokenInfo.valid) {
                return interaction.editReply(`❌ Token invalide: ${tokenInfo.error}`);
            }

            const embed = new EmbedBuilder()
                .setTitle('🔑 Test du Token Twitch')
                .addFields(
                    { name: 'Statut', value: '✅ Valide', inline: true },
                    { name: 'Login', value: tokenInfo.login, inline: true },
                    { name: 'User ID', value: tokenInfo.userId, inline: true },
                    { name: 'Client ID', value: tokenInfo.clientId, inline: false },
                    { name: 'Scopes', value: tokenInfo.scopes.join(', ') || 'Aucun', inline: false }
                )
                .setColor(0x00FF00);

            return interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('❌ Erreur test token:', error);
            return interaction.editReply(`❌ Erreur lors du test: ${error.message}`);
        }
    }

    async _reloadCommandsSlash(interaction) {
        // Vérifier les permissions (admin ou owner)
        if (!interaction.member.permissions.has('Administrator') && interaction.user.id !== interaction.guild.ownerId) {
            return interaction.reply({ content: '❌ Vous devez être administrateur pour utiliser cette commande.', ephemeral: true });
        }
        
        await interaction.deferReply({ ephemeral: true });
        
        try {
            const commandCount = await this.reloadCommands();
            return interaction.editReply(`✅ ${commandCount} commandes rechargées avec succès !`);
        } catch (error) {
            console.error('❌ Erreur rechargement commandes:', error);
            return interaction.editReply(`❌ Erreur lors du rechargement: ${error.message}`);
        }
    }

    // Fonction utilitaire pour les commandes welcome
    async _handleWelcome(interaction) {
        const sub = interaction.options.getSubcommand();
        switch (sub) {
            case 'toggle':
                return interaction.reply({ content:`✅ Système ${interaction.options.getBoolean('activer')?'activé':'désactivé'} (placeholder)`, ephemeral:true });
            case 'add':
                return interaction.reply({ content:`✅ Message ${interaction.options.getString('type')} enregistré (placeholder)`, ephemeral:true });
            case 'remove':
                return interaction.reply({ content:`✅ Message ${interaction.options.getString('type')} supprimé (placeholder)`, ephemeral:true });
            case 'test':
                return interaction.reply({ content:'✅ Test envoyé (placeholder)', ephemeral:true });
            default:
                return interaction.reply({ content:'❌ Sous-commande inconnue', ephemeral:true });
        }
    }

    // Méthodes d'aide pour obtenir les autres modules avec vérification
    getModerationManager() {
        try {
            return this.client.moduleManager?.getModule('moderationManager');
        } catch (error) {
            console.error('❌ Erreur récupération moderationManager:', error);
            return null;
        }
    }

    getVoiceManager() {
        try {
            return this.client.moduleManager?.getModule('voiceManager');
        } catch (error) {
            console.error('❌ Erreur récupération voiceManager:', error);
            return null;
        }
    }

    getWelcomeManager() {
        try {
            console.log('🔍 Récupération welcomeManager...');
            const manager = this.client.moduleManager?.getModule('welcomeManager');
            console.log('📦 WelcomeManager trouvé:', !!manager);
            
            if (manager && typeof manager.handleSlashCommand !== 'function') {
                console.log('⚠️ WelcomeManager trouvé mais handleSlashCommand manquant');
                return null;
            }
            
            return manager;
        } catch (error) {
            console.error('❌ Erreur récupération welcomeManager:', error);
            return null;
        }
    }

    // Gestion temporaire des commandes welcome
    async handleWelcomeCommand(interaction) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'toggle':
                await this.handleWelcomeToggle(interaction);
                break;
            case 'add':
                await this.handleWelcomeAdd(interaction);
                break;
            case 'remove':
                await this.handleWelcomeRemove(interaction);
                break;
            case 'test':
                await this.handleWelcomeTest(interaction);
                break;
            default:
                await interaction.reply({
                    content: '❌ Sous-commande inconnue.',
                    ephemeral: true
                });
        }
    }

    async handleWelcomeToggle(interaction) {
        const enabled = interaction.options.getBoolean('activer');
        
        const embed = new EmbedBuilder()
            .setTitle('👋 Système de bienvenue')
            .setDescription(`Le système a été ${enabled ? 'activé' : 'désactivé'} (fonctionnalité en développement)`)
            .addFields(
                { name: 'État', value: enabled ? '🟢 Activé' : '🔴 Désactivé', inline: true },
                { name: 'Canal', value: `<#${interaction.channel.id}>`, inline: true }
            )
            .setColor(enabled ? 0x00FF00 : 0xFF0000)
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }

    async handleWelcomeAdd(interaction) {
        const type = interaction.options.getString('type');
        const message = interaction.options.getString('message');

        const embed = new EmbedBuilder()
            .setTitle('👋 Message ajouté')
            .setDescription(`Message de ${type === 'join' ? 'bienvenue' : 'départ'} configuré (fonctionnalité en développement)`)
            .addFields(
                { name: 'Type', value: type === 'join' ? 'Arrivée' : 'Départ', inline: true },
                { name: 'Message', value: message, inline: false }
            )
            .setColor(0x00FF00)
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }

    async handleWelcomeRemove(interaction) {
        const type = interaction.options.getString('type');

        const embed = new EmbedBuilder()
            .setTitle('👋 Message supprimé')
            .setDescription(`Message de ${type === 'join' ? 'bienvenue' : 'départ'} supprimé (fonctionnalité en développement)`)
            .addFields({ name: 'Type', value: type === 'join' ? 'Arrivée' : 'Départ', inline: true })
            .setColor(0xFF6600)
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }

    async handleWelcomeTest(interaction) {
        const member = interaction.member;
        
        const embed = new EmbedBuilder()
            .setTitle('🧪 Test du système de bienvenue')
            .setDescription('Messages de test (fonctionnalité en développement)')
            .addFields(
                { 
                    name: '👋 Message d\'arrivée', 
                    value: `Bienvenue ${member} sur le serveur !`, 
                    inline: false 
                },
                { 
                    name: '👋 Message de départ', 
                    value: `${member.displayName} a quitté le serveur.`, 
                    inline: false 
                },
                { 
                    name: 'État du système', 
                    value: '🟡 En développement', 
                    inline: true 
                },
                { 
                    name: 'Canal', 
                    value: `<#${interaction.channel.id}>`, 
                    inline: true 
                }
            )
            .setColor(0x3498DB)
            .setThumbnail(member.user.displayAvatarURL())
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }

    _twitchHeaders() {
        return {
            'Client-ID': this.config.twitchClientId,
            'Authorization': `Bearer ${this.config.twitchUserToken}`
        };
    }

    async _httpHelix(endpoint, { method='GET', body=null } = {}) {
        const url = endpoint.startsWith('http')
            ? endpoint
            : `https://api.twitch.tv/helix/${endpoint}`;
        const res = await fetch(url, {
            method,
            headers: {
                ...this._twitchHeaders(),
                'Content-Type': 'application/json'
            },
            body: body ? JSON.stringify(body) : null
        });
        const data = await res.json().catch(()=> ({}));
        if (!res.ok) {
            const msg = data.message || `${res.status} ${res.statusText}`;
            throw new Error(msg);
        }
        return data;
    }

    _twitchApiReady() {
        if (!this.config.twitchClientId || !this.config.twitchUserToken || !this.config.streamerUsername) return false;
        // Simple vérification format token
        if (!this.config.twitchUserToken.startsWith('oauth:') && this.config.twitchUserToken.length < 20) return false;
        return true;
    }

    async _getStreamerId() {
        if (this._cachedStreamerId) return this._cachedStreamerId;
        const data = await this._httpHelix(`users?login=${this.config.streamerUsername}`);
        if (!data.data?.length) throw new Error('Streamer introuvable');
        this._cachedStreamerId = data.data[0].id;
        return this._cachedStreamerId;
    }

    async _fetchUserId(login) {
        const data = await this._httpHelix(`users?login=${login}`);
        if (!data.data?.length) throw new Error(`Utilisateur "${login}" introuvable`);
        return data.data[0].id;
    }

    async _twitchAddRemove(userType, action, login) {
        const streamerId = await this._getStreamerId();
        const userId = await this._fetchUserId(login);
        const base = userType === 'moderator'
            ? 'moderation/moderators'
            : 'channels/vips';
        const query = `${base}?broadcaster_id=${streamerId}&user_id=${userId}`;
        if (action === 'add') {
            await this._httpHelix(query, { method:'POST', body:{} });
        } else {
            await this._httpHelix(query, { method:'DELETE' });
        }
        return { userId };
    }

    async _twitchList(userType) {
        const streamerId = await this._getStreamerId();
        const base = userType === 'moderator'
            ? 'moderation/moderators'
            : 'channels/vips';
        const data = await this._httpHelix(`${base}?broadcaster_id=${streamerId}`);
        return data.data?.map(d => d.user_name) || [];
    }

    async _twitchBan(action, login, durationSec, reason) {
        const streamerId = await this._getStreamerId();
        const userId = await this._fetchUserId(login);

        if (action === 'unban') {
            await this._httpHelix(
                `moderation/bans?broadcaster_id=${streamerId}&moderator_id=${streamerId}&user_id=${userId}`,
                { method:'DELETE' }
            );
            return;
        }

        const body = {
            data: {
                user_id: userId,
                reason: reason || (action === 'timeout' ? 'Timeout via Discord' : 'Ban via Discord')
            }
        };
        if (action === 'timeout') body.data.duration = durationSec;

        await this._httpHelix(
            `moderation/bans?broadcaster_id=${streamerId}&moderator_id=${streamerId}`,
            { method:'POST', body }
        );
    }

    async _twitchListBans() {
        const streamerId = await this._getStreamerId();
        let cursor = null;
        const users = [];
        let guard = 0;
        do {
            let endpoint = `moderation/banned?broadcaster_id=${streamerId}&first=100`;
            if (cursor) endpoint += `&after=${cursor}`;
            const data = await this._httpHelix(endpoint);
            (data.data||[]).forEach(b => {
                if (b.expires_at) {
                    const leftMs = new Date(b.expires_at) - Date.now();
                    if (leftMs > 0) {
                        const leftMin = Math.floor(leftMs/60000);
                        users.push(`⏰ ${b.user_name} (${leftMin<60?leftMin+'min':Math.floor(leftMin/60)+'h'})`);
                    }
                } else users.push(`🔨 ${b.user_name}`);
            });
            cursor = data.pagination?.cursor;
            guard++;
        } while (cursor && users.length < 1000 && guard < 30);
        return users;
    }

    async _twitchSearch(query, scope) {
        query = query.toLowerCase();
        if (query.length < 2) return { results:[], note:'Min 2 caractères' };
        const res = [];
        if (scope==='all' || scope==='mods') {
            try { (await this._twitchList('moderator')).filter(m=>m.toLowerCase().includes(query)).forEach(m=>res.push(`🛡️ ${m}`)); } catch {}
        }
        if (scope==='all' || scope==='vips') {
            try { (await this._twitchList('vip')).filter(v=>v.toLowerCase().includes(query)).forEach(v=>res.push(`⭐ ${v}`)); } catch {}
        }
        if (scope==='all' || scope==='bans') {
            try { (await this._twitchListBans()).filter(b=>b.toLowerCase().includes(query)).forEach(b=>res.push(b)); } catch {}
        }
        return { results:res };
    }

    async _handleTwitchCommand(interaction, cmd) {
        try {
            const login = interaction.options.getString('username');
            switch (cmd) {
                case 'twitchaddmod': {
                    await this._twitchAddRemove('moderator','add',login);
                    return interaction.editReply(`🛡️ ${login} ajouté modérateur Twitch`);
                }
                case 'twitchremovemod': {
                    await this._twitchAddRemove('moderator','remove',login);
                    return interaction.editReply(`🛡️ ${login} retiré modérateur Twitch`);
                }
                case 'twitchaddvip': {
                    await this._twitchAddRemove('vip','add',login);
                    return interaction.editReply(`⭐ ${login} ajouté VIP Twitch`);
                }
                case 'twitchremovevip': {
                    await this._twitchAddRemove('vip','remove',login);
                    return interaction.editReply(`⭐ ${login} retiré VIP Twitch`);
                }
                case 'twitchban': {
                    const reason = interaction.options.getString('reason');
                    await this._twitchBan('ban',login,null,reason);
                    return interaction.editReply(`🔨 ${login} banni (permanent)${reason?`\nRaison: ${reason}`:''}`);
                }
                case 'twitchunban': {
                    await this._twitchBan('unban',login);
                    return interaction.editReply(`✅ ${login} débanni`);
                }
                case 'twitchtimeout': {
                    const duration = interaction.options.getInteger('duration');
                    const reason = interaction.options.getString('reason');
                    await this._twitchBan('timeout',login,duration,reason);
                    const human = duration>=3600?`${Math.floor(duration/3600)}h`:`${Math.floor(duration/60)}min`;
                    return interaction.editReply(`⏰ ${login} timeout ${human}${reason?`\nRaison: ${reason}`:''}`);
                }
                case 'twitchlistmods': {
                    const mods = await this._twitchList('moderator');
                    return interaction.editReply(mods.length?`🛡️ Mods (${mods.length}):\n${mods.join(', ')}`:'Aucun modérateur');
                }
                case 'twitchlistvips': {
                    const vips = await this._twitchList('vip');
                    return interaction.editReply(vips.length?`⭐ VIP (${vips.length}):\n${vips.join(', ')}`:'Aucun VIP');
                }
                case 'twitchlistbans': {
                    const bans = await this._twitchListBans();
                    if (!bans.length) return interaction.editReply('🎉 Aucun ban');
                    const first = bans.slice(0,50).join('\n');
                    return interaction.editReply(`🔨 Bans (${bans.length}):\n${first}${bans.length>50?'\n...':''}`);
                }
                case 'twitchsearch': {
                    const q = interaction.options.getString('query');
                    const scope = interaction.options.getString('dans') || 'all';
                    const { results, note } = await this._twitchSearch(q, scope);
                    if (note) return interaction.editReply(`⚠️ ${note}`);
                    return interaction.editReply(results.length?`🔍 Résultats (${results.length}):\n${results.slice(0,60).join('\n')}`:`Aucun résultat pour "${q}"`);
                }
            }
        } catch (e) {
            const msg = e.message.includes('401') ? 'Authentification Twitch invalide (scopes manquants ?)' : e.message;
            return interaction.editReply(`❌ Erreur Twitch: ${msg}`);
        }
    }
}

module.exports = CommandHandler;