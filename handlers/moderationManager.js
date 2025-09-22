const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

class ModerationManager {
    constructor(client, config) {
        this.client = client;
        this.config = config;
    }

    async initialize() {
        console.log('✅ ModerationManager initialisé');
    }

    hasAdmin(member) {
        return member.permissions.has(PermissionFlagsBits.Administrator) ||
               member.permissions.has(PermissionFlagsBits.ManageGuild) ||
               member.permissions.has(PermissionFlagsBits.ManageRoles);
    }

    async handleDiscordModerationCommand(interaction, command) {
        return this.handleSlashCommand(interaction, command);
    }

    async handleSlashCommand(interaction, command) {
        switch (command) {
            case 'addmodo':
            case 'removemodo': return this._modRole(interaction, command);
            case 'addvip':
            case 'removevip': return this._vipRole(interaction, command);
            case 'ban':
            case 'discordban': return this._ban(interaction); // alias
            case 'timeout':
            case 'mute': return this._timeout(interaction);   // alias mute -> timeout
            case 'unmute': return this._unmute(interaction);
            case 'kick': return this._kick(interaction);
            case 'unban': return this._unban(interaction);
            case 'warn': return this._warn(interaction);
            case 'search': return this._search(interaction);
            case 'listmods': return this._list(interaction,'Modérateur','🛡️');
            case 'listvips': return this._list(interaction,'VIP','⭐');
            case 'listbans': return this._listBans(interaction);
            case 'userinfo': return this._userInfo(interaction);
            default: return interaction.reply({ content:'❌ Commande inconnue', ephemeral:true });
        }
    }

    async _findOrCreate(guild, name, color='#777777') {
        let role = guild.roles.cache.find(r => r.name.toLowerCase() === name.toLowerCase());
        if (!role) role = await guild.roles.create({ name, color, reason:`Créé par bot (${name})` });
        return role;
    }

    async _roleFlow(interaction, action, roleName, color) {
        if (!this.hasAdmin(interaction.member))
            return interaction.reply({ content:'❌ Permissions insuffisantes', ephemeral:true });
        const target = interaction.options.getMember('utilisateur');
        if (!target) return interaction.reply({ content:'❌ Utilisateur introuvable', ephemeral:true });
        const role = await this._findOrCreate(interaction.guild, roleName, color);
        const has = target.roles.cache.has(role.id);
        try {
            if (action === 'add') {
                if (has) return interaction.reply({ content:`ℹ️ ${target.displayName} a déjà ${roleName}`, ephemeral:true });
                await target.roles.add(role);
                return interaction.reply({ content:`✅ ${target.displayName} est maintenant ${roleName}` });
            } else {
                if (!has) return interaction.reply({ content:`ℹ️ ${target.displayName} n'est pas ${roleName}`, ephemeral:true });
                await target.roles.remove(role);
                return interaction.reply({ content:`✅ ${target.displayName} n'est plus ${roleName}` });
            }
        } catch (err) {
            console.error('❌ Erreur rôle:', err);
            return interaction.reply({ content:'❌ Erreur rôle', ephemeral:true });
        }
    }
    
    _modRole(i,c){ return this._roleFlow(i, c==='addmodo'?'add':'remove','Modérateur','#ff6666'); }
    _vipRole(i,c){ return this._roleFlow(i, c==='addvip'?'add':'remove','VIP','#ffd700'); }

    async _ban(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers))
            return interaction.reply({ content:'❌ Pas la permission', ephemeral:true });
        const target = interaction.options.getMember('utilisateur');
        const reason = interaction.options.getString('raison') || 'Aucune';
        if (!target) return interaction.reply({ content:'❌ Introuvable', ephemeral:true });
        if (target.id === interaction.user.id) return interaction.reply({ content:'❌ Non', ephemeral:true });
        try {
            await target.ban({ reason:`${reason} - ${interaction.user.tag}` });
            const emb = new EmbedBuilder()
                .setTitle('🔨 Bannissement')
                .setDescription(`${target.user.tag} banni`)
                .addFields(
                    { name:'Modérateur', value:interaction.user.tag, inline:true },
                    { name:'Raison', value:reason, inline:true }
                ).setColor(0xFF0000);
            await interaction.reply({ embeds:[emb] });
            await this._log(interaction.guild, emb);
        } catch (err) {
            console.error('❌ Erreur ban:', err);
            return interaction.reply({ content:'❌ Échec bannissement', ephemeral:true });
        }
    }

    async _timeout(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers))
            return interaction.reply({ content:'❌ Pas la permission', ephemeral:true });
        const target = interaction.options.getMember('utilisateur');
        const minutes = interaction.options.getInteger('duree');
        const reason = interaction.options.getString('raison') || 'Aucune';
        if (!target) return interaction.reply({ content:'❌ Introuvable', ephemeral:true });
        if (target.id === interaction.user.id) return interaction.reply({ content:'❌ Non', ephemeral:true });
        try {
            const ms = minutes * 60000;
            await target.timeout(ms, `${reason} - ${interaction.user.tag}`);
            const end = Math.floor((Date.now()+ms)/1000);
            const emb = new EmbedBuilder()
                .setTitle('⏰ Timeout')
                .setDescription(`${target.user.tag} sanctionné`)
                .addFields(
                    { name:'Durée', value:`${minutes} min`, inline:true },
                    { name:'Fin', value:`<t:${end}:R>`, inline:true },
                    { name:'Raison', value:reason, inline:true }
                ).setColor(0xFF9900);
            await interaction.reply({ embeds:[emb] });
            await this._log(interaction.guild, emb);
        } catch (err) {
            console.error('❌ Erreur timeout:', err);
            return interaction.reply({ content:'❌ Échec timeout', ephemeral:true });
        }
    }

    async _unmute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers))
            return interaction.reply({ content:'❌ Pas la permission', ephemeral:true });
        const target = interaction.options.getMember('utilisateur');
        const reason = interaction.options.getString('raison') || 'Retrait timeout';
        if (!target) return interaction.reply({ content:'❌ Introuvable', ephemeral:true });
        try {
            await target.timeout(null, `${reason} - ${interaction.user.tag}`);
            const emb = new EmbedBuilder()
                .setTitle('🔓 Unmute')
                .setDescription(`${target.user.tag} n'est plus en timeout`)
                .addFields(
                    { name:'Modérateur', value:interaction.user.tag, inline:true },
                    { name:'Raison', value:reason, inline:true }
                ).setColor(0x2ECC71);
            await interaction.reply({ embeds:[emb] });
            await this._log(interaction.guild, emb);
        } catch (err) {
            console.error('❌ Erreur unmute:', err);
            return interaction.reply({ content:'❌ Échec unmute', ephemeral:true });
        }
    }

    async _kick(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.KickMembers))
            return interaction.reply({ content:'❌ Pas la permission', ephemeral:true });
        const target = interaction.options.getMember('utilisateur');
        const reason = interaction.options.getString('raison') || 'Aucune';
        if (!target) return interaction.reply({ content:'❌ Introuvable', ephemeral:true });
        if (target.id === interaction.user.id) return interaction.reply({ content:'❌ Non', ephemeral:true });
        try {
            await target.kick(`${reason} - ${interaction.user.tag}`);
            const emb = new EmbedBuilder()
                .setTitle('👢 Expulsion')
                .setDescription(`${target.user.tag} expulsé`)
                .addFields(
                    { name:'Modérateur', value:interaction.user.tag, inline:true },
                    { name:'Raison', value:reason, inline:true }
                ).setColor(0xE67E22);
            await interaction.reply({ embeds:[emb] });
            await this._log(interaction.guild, emb);
        } catch (err) {
            console.error('❌ Erreur kick:', err);
            return interaction.reply({ content:'❌ Échec expulsion', ephemeral:true });
        }
    }

    async _unban(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers))
            return interaction.reply({ content:'❌ Pas la permission', ephemeral:true });
        const userId = interaction.options.getString('userid');
        const reason = interaction.options.getString('raison') || 'Aucune';
        if (!userId) return interaction.reply({ content:'❌ ID requis', ephemeral:true });
        try {
            await interaction.guild.bans.remove(userId, `${reason} - ${interaction.user.tag}`);
            const emb = new EmbedBuilder()
                .setTitle('✅ Unban')
                .setDescription(`ID ${userId} débanni`)
                .addFields(
                    { name:'Modérateur', value:interaction.user.tag, inline:true },
                    { name:'Raison', value:reason, inline:true }
                ).setColor(0x2ECC71);
            await interaction.reply({ embeds:[emb] });
            await this._log(interaction.guild, emb);
        } catch (err) {
            console.error('❌ Erreur unban:', err);
            return interaction.reply({ content:'❌ Échec unban', ephemeral:true });
        }
    }

    async _warn(interaction) {
        if (!this.hasAdmin(interaction.member))
            return interaction.reply({ content:'❌ Pas la permission', ephemeral:true });
        const target = interaction.options.getMember('utilisateur');
        const reason = interaction.options.getString('raison');
        if (!target) return interaction.reply({ content:'❌ Introuvable', ephemeral:true });
        try {
            const emb = new EmbedBuilder()
                .setTitle('⚠️ Avertissement')
                .setDescription(`${target.user.tag} averti`)
                .addFields(
                    { name:'Raison', value:reason, inline:true },
                    { name:'Modérateur', value:interaction.user.tag, inline:true }
                ).setColor(0xF1C40F);
            await interaction.reply({ embeds:[emb] });
            await this._log(interaction.guild, emb);
            // (Option stockage persistant à ajouter plus tard)
        } catch (err) {
            console.error('❌ Erreur warn:', err);
            return interaction.reply({ content:'❌ Échec avertissement', ephemeral:true });
        }
    }

    async _search(interaction) {
        const term = interaction.options.getString('terme');
        const members = await interaction.guild.members.fetch();
        const found = members.filter(m =>
            m.user.username.toLowerCase().includes(term.toLowerCase()) ||
            m.displayName.toLowerCase().includes(term.toLowerCase()) ||
            m.id === term
        );
        if (found.size === 0)
            return (interaction.deferred ? interaction.editReply('❌ Aucun résultat') : interaction.reply({ content:'❌ Aucun résultat', ephemeral:true }));
        if (found.size === 1)
            return this._userEmbedReply(interaction, found.first(), !!interaction.deferred);

        const list = [...found.values()].slice(0, 15).map(m=>`• ${m.user.tag} (${m.id})`).join('\n');
        const emb = new EmbedBuilder()
            .setTitle(`🔍 Résultats (${found.size})`)
            .setDescription(list + (found.size>15?`\n... +${found.size-15}`:''))
            .setColor(0x3498DB);
        return interaction.deferred ? interaction.editReply({ embeds:[emb] }) : interaction.reply({ embeds:[emb], ephemeral:true });
    }

    async _list(interaction, roleName, emoji) {
        const role = interaction.guild.roles.cache.find(r => r.name === roleName);
        if (!role) return interaction.reply({ content:`❌ Rôle ${roleName} inexistant`, ephemeral:true });
        if (role.members.size === 0) return interaction.reply({ content:`ℹ️ Aucun ${roleName}`, ephemeral:true });
        const emb = new EmbedBuilder()
            .setTitle(`${emoji} ${roleName}s (${role.members.size})`)
            .setDescription(role.members.map(m=>m.user.tag).join('\n'))
            .setColor(roleName==='VIP'?0xFFD700:0xFF6666);
        return interaction.reply({ embeds:[emb], ephemeral:true });
    }

    async _listBans(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers))
            return interaction.reply({ content:'❌ Pas la permission', ephemeral:true });
        const bans = await interaction.guild.bans.fetch();
        if (bans.size === 0)
            return interaction.deferred ? interaction.editReply('ℹ️ Aucun ban') : interaction.reply({ content:'ℹ️ Aucun ban', ephemeral:true });
        const list = [...bans.values()].slice(0,20).map(b=>`• ${b.user.tag} (${b.user.id})`).join('\n');
        const emb = new EmbedBuilder()
            .setTitle(`🚫 Bannis (${bans.size})`)
            .setDescription(list + (bans.size>20?`\n... +${bans.size-20}`:''))
            .setColor(0x8B0000);
        return interaction.deferred ? interaction.editReply({ embeds:[emb] }) : interaction.reply({ embeds:[emb], ephemeral:true });
    }

    async _userInfo(interaction) {
        const member = interaction.options.getMember('utilisateur') || interaction.member;
        return this._userEmbedReply(interaction, member, !!interaction.deferred);
    }

    async _userEmbedReply(interaction, member, editing) {
        const roles = member.roles.cache.filter(r=>r.name!=='@everyone');
        const emb = new EmbedBuilder()
            .setTitle('👤 Utilisateur')
            .setDescription(member.user.tag)
            .setThumbnail(member.user.displayAvatarURL())
            .addFields(
                { name:'ID', value:member.id, inline:true },
                { name:'Bot', value:member.user.bot?'Oui':'Non', inline:true },
                { name:'Créé', value:`<t:${Math.floor(member.user.createdTimestamp/1000)}:d>`, inline:true },
                { name:'Rejoint', value:`<t:${Math.floor(member.joinedTimestamp/1000)}:d>`, inline:true },
                { name:'Rôles', value: roles.size?roles.map(r=>r.name).join(', '):'Aucun', inline:false }
            ).setColor(0x3A87F5);
        return editing ? interaction.editReply({ embeds:[emb] }) : interaction.reply({ embeds:[emb], ephemeral:true });
    }

    async _log(guild, embed) {
        const id = this.config.moderationChannelId || this.config.logsChannelId;
        if (!id) return;
        const ch = guild.channels.cache.get(id);
        if (!ch) return;
        if (!ch.permissionsFor(guild.members.me).has('SendMessages')) return;
        try { await ch.send({ embeds:[embed] }); } catch {}
    }

    // Utilitaires supplémentaires
    async replyUserInfo(interaction, member, editing) {
        const embed = new EmbedBuilder()
            .setTitle('👤 Informations Utilisateur')
            .setDescription(`Informations sur **${member.user.tag}**`)
            .setThumbnail(member.user.displayAvatarURL())
            .addFields(
                { name: 'ID', value: member.id, inline: true },
                { name: 'Nom', value: member.user.username, inline: true },
                { name: 'Surnom', value: member.displayName, inline: true },
                { name: 'Compte créé', value: `<t:${Math.floor(member.user.createdTimestamp/1000)}:F>`, inline: true },
                { name: 'A rejoint', value: `<t:${Math.floor(member.joinedTimestamp/1000)}:F>`, inline: true },
                { name: 'Bot', value: member.user.bot ? 'Oui' : 'Non', inline: true }
            )
            .setColor(0x3498DB)
            .setTimestamp();
        
        const roles = member.roles.cache.filter(r => r.name !== '@everyone');
        if (roles.size)
            embed.addFields({ name: `Rôles (${roles.size})`, value: roles.map(r => r.name).join(', ') });
        
        if (editing) return interaction.editReply({ embeds: [embed] });
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Méthode d'utilitaire pour vérifier les permissions
    hasAdminPermission(member) {
        return member.permissions.has(PermissionFlagsBits.Administrator) || 
               member.permissions.has(PermissionFlagsBits.ManageGuild) ||
               member.permissions.has(PermissionFlagsBits.ManageRoles);
    }

    // Méthode d'utilitaire pour créer/trouver un rôle
    async findOrCreateRole(guild, roleName, color = '#99AAB5') {
        let role = guild.roles.cache.find(r => r.name === roleName);
        
        if (!role) {
            try {
                role = await guild.roles.create({
                    name: roleName,
                    color: color,
                    reason: `Rôle ${roleName} créé automatiquement`
                });
            } catch (error) {
                console.error(`Erreur création rôle ${roleName}:`, error);
                return null;
            }
        }
        
        return role;
    }

    // Méthode pour envoyer les logs de modération
    async sendModerationLog(guild, embed) {
        try {
            let moderationChannel = null;

            // Utiliser le canal de modération configuré
            if (this.config.moderationChannelId) {
                moderationChannel = guild.channels.cache.get(this.config.moderationChannelId);
            }

            // Fallback vers le canal de logs
            if (!moderationChannel && this.config.logsChannelId) {
                moderationChannel = guild.channels.cache.get(this.config.logsChannelId);
            }

            if (moderationChannel && moderationChannel.permissionsFor(guild.members.me).has('SendMessages')) {
                await moderationChannel.send({ embeds: [embed] });
                console.log(`📝 Log de modération envoyé dans #${moderationChannel.name}`);
            }
        } catch (error) {
            console.error('❌ Erreur envoi log modération:', error);
        }
    }
    
    // Implémentation de handleListVips provenant de votre code
    async handleListVips(interaction) {
        const vipRole = interaction.guild.roles.cache.find(role => role.name === 'VIP');
        
        if (!vipRole) {
            return interaction.reply({ content: '❌ Aucun rôle VIP trouvé', ephemeral: true });
        }

        const vips = vipRole.members;
        
        if (vips.size === 0) {
            return interaction.reply({ content: 'ℹ️ Aucun VIP actuellement', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setTitle('⭐ Liste des VIP')
            .setDescription(`${vips.size} VIP(s) actif(s)`)
            .setColor(0xFFD700)
            .setTimestamp();

        const vipList = vips.map(member => 
            `• ${member.user.tag} ${member.user.bot ? '🤖' : ''}`
        ).join('\n');

        embed.addFields({ name: 'VIPs', value: vipList });

        await interaction.reply({ embeds: [embed] });
    }

    // Implémentation de showUserInfo provenant de votre code
    async showUserInfo(interaction, member) {
        const embed = new EmbedBuilder()
            .setTitle('👤 Informations Utilisateur')
            .setDescription(`Informations sur **${member.user.tag}**`)
            .setThumbnail(member.user.displayAvatarURL())
            .addFields(
                { name: 'ID', value: member.id, inline: true },
                { name: 'Nom d\'utilisateur', value: member.user.username, inline: true },
                { name: 'Surnom', value: member.displayName, inline: true },
                { name: 'Compte créé', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:F>`, inline: true },
                { name: 'A rejoint', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>`, inline: true },
                { name: 'Bot', value: member.user.bot ? 'Oui' : 'Non', inline: true }
            )
            .setColor(0x3498DB)
            .setTimestamp();

        const roles = member.roles.cache.filter(role => role.name !== '@everyone');
        if (roles.size > 0) {
            embed.addFields({ 
                name: `Rôles (${roles.size})`, 
                value: roles.map(role => role.name).join(', ') 
            });
        }

        await interaction.reply({ embeds: [embed] });
    }

    // Nouvelle commande userInfo 
    async handleUserInfo(interaction) {
        try {
            let member = interaction.options.getMember('utilisateur') || interaction.member;
            if (!member) {
                const content = '❌ Utilisateur introuvable';
                if (interaction.deferred) return interaction.editReply(content);
                return interaction.reply({ content, ephemeral: true });
            }
            
            if (interaction.deferred) {
                return this.replyUserInfo(interaction, member, true);
            } else {
                return this.replyUserInfo(interaction, member, false);
            }
        } catch (e) {
            const msg = '❌ Erreur récupération utilisateur';
            if (interaction.deferred) return interaction.editReply(msg);
            return interaction.reply({ content: msg, ephemeral: true });
        }
    }
}

module.exports = ModerationManager;
