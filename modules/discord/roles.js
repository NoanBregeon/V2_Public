const logger = require('../utils/logger');
const twitchSync = require('../twitch/sync');

class RoleSync {
    constructor() {
        this.client = null;
        this.guild = null;
        this.roles = {
            vip: null,
            moderator: null,
            subscriber: null
        };
        this.intervalId = null;
    }
    
    init(client) {
        this.client = client;
        
        // Attendre que le bot soit prêt
        client.once('ready', async () => {
            await this.setupRoles();
            this.startSync();
        });
        
        logger.success('🔄 Synchronisation des rôles Discord initialisée');
    }
    
    async setupRoles() {
        try {
            // Récupérer le serveur principal
            this.guild = this.client.guilds.cache.first();
            if (!this.guild) {
                logger.error('Aucun serveur Discord trouvé');
                return;
            }
            
            // Récupérer les rôles configurés
            if (process.env.VIP_ROLE_ID) {
                this.roles.vip = this.guild.roles.cache.get(process.env.VIP_ROLE_ID);
                if (!this.roles.vip) {
                    logger.warn(`Rôle VIP non trouvé: ${process.env.VIP_ROLE_ID}`);
                }
            }
            
            if (process.env.MODERATOR_ROLE_ID) {
                this.roles.moderator = this.guild.roles.cache.get(process.env.MODERATOR_ROLE_ID);
                if (!this.roles.moderator) {
                    logger.warn(`Rôle Modérateur non trouvé: ${process.env.MODERATOR_ROLE_ID}`);
                }
            }
            
            if (process.env.SUBSCRIBER_ROLE_ID) {
                this.roles.subscriber = this.guild.roles.cache.get(process.env.SUBSCRIBER_ROLE_ID);
                if (!this.roles.subscriber) {
                    logger.warn(`Rôle Subscriber non trouvé: ${process.env.SUBSCRIBER_ROLE_ID}`);
                }
            }
            
            // Créer les rôles manquants si nécessaire
            await this.createMissingRoles();
            
            logger.success(`Rôles configurés sur ${this.guild.name}`);
            
        } catch (error) {
            logger.error('Erreur configuration rôles:', error);
        }
    }
    
    async createMissingRoles() {
        try {
            // Créer le rôle VIP s'il n'existe pas
            if (!this.roles.vip && !process.env.VIP_ROLE_ID) {
                this.roles.vip = await this.guild.roles.create({
                    name: '👑 VIP Twitch',
                    color: 0xffd700, // Doré
                    reason: 'Rôle automatique pour les VIP Twitch'
                });
                logger.success(`Rôle VIP créé: ${this.roles.vip.id}`);
            }
            
            // Créer le rôle Modérateur s'il n'existe pas
            if (!this.roles.moderator && !process.env.MODERATOR_ROLE_ID) {
                this.roles.moderator = await this.guild.roles.create({
                    name: '🛡️ Modérateur Twitch',
                    color: 0x00ff00, // Vert
                    reason: 'Rôle automatique pour les modérateurs Twitch'
                });
                logger.success(`Rôle Modérateur créé: ${this.roles.moderator.id}`);
            }
            
        } catch (error) {
            logger.error('Erreur création rôles:', error);
        }
    }
    
    startSync() {
        if (!this.guild) return;
        
        // Synchronisation immédiate
        setTimeout(() => {
            this.syncRoles().catch(error => {
                logger.error('Erreur sync rôles initiale:', error);
            });
        }, 5000); // Attendre 5 secondes après le démarrage
        
        // Synchronisation périodique (toutes les 2 minutes)
        this.intervalId = setInterval(() => {
            this.syncRoles().catch(error => {
                logger.error('Erreur sync rôles périodique:', error);
            });
        }, 120000);
        
        logger.info('🔄 Synchronisation périodique des rôles démarrée');
    }
    
    async syncRoles() {
        try {
            logger.debug('🔄 Synchronisation des rôles en cours...');
            
            // Récupérer les listes Twitch
            const vips = twitchSync.getVIPs();
            const moderators = twitchSync.getModerators();
            
            // Synchroniser les VIP
            if (this.roles.vip) {
                await this.syncRoleType('vip', vips, this.roles.vip);
            }
            
            // Synchroniser les modérateurs
            if (this.roles.moderator) {
                await this.syncRoleType('moderator', moderators, this.roles.moderator);
            }
            
            logger.debug('✅ Synchronisation des rôles terminée');
            
        } catch (error) {
            logger.error('Erreur synchronisation rôles:', error);
        }
    }
    
    async syncRoleType(type, twitchList, role) {
        try {
            // Récupérer tous les membres du serveur
            await this.guild.members.fetch();
            
            const membersWithRole = role.members.map(member => member);
            let added = 0;
            let removed = 0;
            
            // Parcourir tous les membres du serveur
            for (const [memberId, member] of this.guild.members.cache) {
                const hasRole = member.roles.cache.has(role.id);
                const shouldHaveRole = await this.shouldMemberHaveRole(member, twitchList);
                
                if (shouldHaveRole && !hasRole) {
                    // Ajouter le rôle
                    try {
                        await member.roles.add(role, `Synchronisation ${type} Twitch`);
                        added++;
                        logger.info(`➕ Rôle ${type} ajouté à ${member.displayName}`);
                    } catch (error) {
                        logger.warn(`Erreur ajout rôle ${type} à ${member.displayName}:`, error.message);
                    }
                } else if (!shouldHaveRole && hasRole) {
                    // Retirer le rôle
                    try {
                        await member.roles.remove(role, `Synchronisation ${type} Twitch`);
                        removed++;
                        logger.info(`➖ Rôle ${type} retiré à ${member.displayName}`);
                    } catch (error) {
                        logger.warn(`Erreur suppression rôle ${type} à ${member.displayName}:`, error.message);
                    }
                }
            }
            
            if (added > 0 || removed > 0) {
                logger.success(`Sync ${type}: +${added} -${removed}`);
            }
            
        } catch (error) {
            logger.error(`Erreur sync rôle ${type}:`, error);
        }
    }
    
    async shouldMemberHaveRole(member, twitchList) {
        // Vérifier si le pseudo Discord correspond à un pseudo Twitch
        const displayName = member.displayName.toLowerCase();
        const username = member.user.username.toLowerCase();
        
        // Recherche directe par pseudo
        if (twitchList.includes(displayName) || twitchList.includes(username)) {
            return true;
        }
        
        // Recherche dans le nickname (si défini)
        if (member.nickname) {
            const nickname = member.nickname.toLowerCase();
            if (twitchList.includes(nickname)) {
                return true;
            }
        }
        
        // TODO: Ajouter une logique de mapping Discord -> Twitch si nécessaire
        // Par exemple, une base de données ou un système de liaison de comptes
        
        return false;
    }
    
    // Méthodes utilitaires
    async forceSync() {
        logger.info('🔄 Synchronisation des rôles forcée');
        await this.syncRoles();
    }
    
    async addRoleMapping(discordId, twitchUsername) {
        // TODO: Implémenter un système de mapping personnalisé
        // Pour lier manuellement des comptes Discord à des pseudos Twitch
        logger.info(`Mapping ajouté: ${discordId} -> ${twitchUsername}`);
    }
    
    getStats() {
        return {
            guild: this.guild?.name,
            vipRole: this.roles.vip?.name,
            moderatorRole: this.roles.moderator?.name,
            subscriberRole: this.roles.subscriber?.name,
            vipMembers: this.roles.vip?.members.size || 0,
            moderatorMembers: this.roles.moderator?.members.size || 0,
            subscriberMembers: this.roles.subscriber?.members.size || 0
        };
    }
    
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
}

module.exports = new RoleSync();