/**
 * Gestionnaire des interactions (boutons, menus)
 */

class InteractionHandler {
    constructor(client, config) {
        this.client = client;
        this.config = config;
        this.notificationRole = null;
    }

    async initialize() {
        // Attendre que le bot soit prêt avant de créer le rôle
        if (this.client.isReady()) {
            await this.ensureNotificationRole();
        } else {
            this.client.once('ready', async () => {
                await this.ensureNotificationRole();
            });
        }
        
        this.client.on('interactionCreate', async (interaction) => {
            if (interaction.isButton()) {
                await this.handleButton(interaction);
            }
        });
        
        console.log('✅ InteractionHandler initialisé');
    }

    async ensureNotificationRole() {
        try {
            // Utiliser la première guild disponible (pour test)
            const guild = this.client.guilds.cache.first();
            
            if (!guild) {
                console.warn('⚠️ Aucune guild trouvée pour créer le rôle notification');
                return;
            }
            
            console.log(`🔍 Création du rôle sur la guild: ${guild.name} (${guild.id})`);
            
            let role = guild.roles.cache.find(r => r.name === 'Live Notifications');
            
            if (!role) {
                role = await guild.roles.create({
                    name: 'Live Notifications',
                    color: 0x9146FF,
                    reason: 'Rôle automatique pour notifications Twitch'
                });
                console.log(`✅ Rôle "Live Notifications" créé sur ${guild.name}`);
            } else {
                console.log(`✅ Rôle "Live Notifications" trouvé sur ${guild.name}`);
            }
            
            this.notificationRole = role;
            
        } catch (error) {
            console.error('❌ Erreur création rôle notification:', error);
        }
    }

    async handleButton(interaction) {
        if (interaction.customId === 'twitch_notif_toggle') {
            await this.toggleNotificationRole(interaction);
        }
    }

    async toggleNotificationRole(interaction) {
        // Récupérer le rôle sur la guild de l'interaction
        const guild = interaction.guild;
        let notifRole = guild.roles.cache.find(r => r.name === 'Live Notifications');
        
        if (!notifRole) {
            try {
                notifRole = await guild.roles.create({
                    name: 'Live Notifications',
                    color: 0x9146FF,
                    reason: 'Rôle automatique pour notifications Twitch'
                });
            } catch (error) {
                return interaction.reply({
                    content: '❌ Erreur: Impossible de créer le rôle de notification.',
                    ephemeral: true
                });
            }
        }

        try {
            const member = interaction.member;
            const hasRole = member.roles.cache.has(notifRole.id);

            if (hasRole) {
                await member.roles.remove(notifRole);
                return interaction.reply({
                    content: '🔕 Vous ne recevrez plus de notifications de stream.',
                    ephemeral: true
                });
            } else {
                await member.roles.add(notifRole);
                return interaction.reply({
                    content: '🔔 Vous recevrez maintenant les notifications de stream !',
                    ephemeral: true
                });
            }
        } catch (error) {
            console.error('❌ Erreur toggle rôle notification:', error);
            return interaction.reply({
                content: '❌ Erreur lors de la modification du rôle.',
                ephemeral: true
            });
        }
    }
}

module.exports = InteractionHandler;
