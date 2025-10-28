/**
 * Gestionnaire de permissions centralisé
 * Sécurité renforcée pour les commandes Twitch spécialisées
 */

class PermissionManager {
    constructor(config) {
        this.config = config;
        
        // Commandes Twitch nécessitant des permissions d'administrateur
        this.twitchAdminCommands = [
            'twitch-vip',
            'twitch-mod', 
            'assign-vip-role',
            'assign-mod-role',
            'manage-subscriber',
            'promote-vip',
            'demote-vip',
            'add-moderator',
            'remove-moderator'
        ];
    }

    /**
     * Vérifie si l'utilisateur est administrateur Discord
     */
    isAdmin(member) {
        return member.permissions.has('Administrator');
    }

    /**
     * Vérifie si l'utilisateur est modérateur (rôle configuré)
     */
    isModerator(member) {
        if (this.isAdmin(member)) return true;
        if (!this.config.moderatorRoleId) return false;
        return member.roles.cache.has(this.config.moderatorRoleId);
    }

    /**
     * Vérification stricte pour les commandes Twitch sensibles
     * Seuls les administrateurs Discord peuvent gérer les rôles VIP/Mod
     */
    canUseTwitchAdminCommand(member, commandName) {
        if (!this.twitchAdminCommands.includes(commandName)) {
            return true; // Commande non sensible
        }
        
        // Pour les commandes sensibles, seuls les administrateurs
        return this.isAdmin(member);
    }

    /**
     * Vérification pour les commandes Twitch de base
     */
    canUseTwitchCommand(member) {
        return this.isModerator(member);
    }

    /**
     * Messages d'erreur standardisés
     */
    getPermissionError(requiredLevel = 'modérateur') {
        const messages = {
            'administrateur': '❌ **Accès refusé** - Cette commande est réservée aux **Administrateurs** uniquement.',
            'modérateur': '❌ **Accès refusé** - Cette commande nécessite le rôle **Modérateur** ou supérieur.'
        };
        
        return messages[requiredLevel] || messages['modérateur'];
    }

    /**
     * Log des tentatives d'accès non autorisées
     */
    logUnauthorizedAccess(member, commandName, channelId) {
        console.warn(`🚨 Tentative d'accès non autorisée:
        - Utilisateur: ${member.user.tag} (${member.id})
        - Commande: ${commandName}
        - Canal: ${channelId}
        - Permissions: Admin=${this.isAdmin(member)}, Mod=${this.isModerator(member)}`);
    }
}

module.exports = PermissionManager;
