const twitchAPI = require('./api');
const logger = require('../utils/logger');
const helpers = require('../utils/helpers');
const templates = require('../utils/templates');

class TwitchNotifications {
    constructor() {
        this.client = null;
        this.isLive = false;
        this.liveStartTime = null;
        this.intervalId = null;
        this.currentStreamInfo = null;
    }
    
    async init(client) {
        this.client = client;
        
        if (!process.env.NOTIFICATIONS_CHANNEL_ID) {
            logger.warn('Canal de notifications Discord non configuré');
            return;
        }
        
        logger.info('📢 Système de notifications Twitch initialisé');
        
        // Vérification immédiate
        await this.checkStreamStatus();
        
        // Vérification périodique (toutes les 30 secondes)
        this.intervalId = setInterval(() => {
            this.checkStreamStatus().catch(error => {
                logger.error('Erreur vérification stream:', error);
            });
        }, 30000);
    }
    
    async checkStreamStatus() {
        try {
            const streamInfo = await twitchAPI.getStreamInfo();
            const wasLive = this.isLive;
            this.isLive = !!streamInfo;
            
            if (!wasLive && this.isLive) {
                // Stream vient de commencer
                this.liveStartTime = new Date(streamInfo.started_at);
                this.currentStreamInfo = streamInfo;
                await this.sendLiveNotification(streamInfo);
            } else if (wasLive && !this.isLive) {
                // Stream vient de se terminer
                await this.sendOfflineNotification();
                this.liveStartTime = null;
                this.currentStreamInfo = null;
            } else if (this.isLive && streamInfo) {
                // Stream en cours - mise à jour des infos
                this.currentStreamInfo = streamInfo;
            }
        } catch (error) {
            logger.error('Erreur vérification statut stream:', error);
        }
    }
    
    async sendLiveNotification(streamInfo) {
        try {
            const channel = this.client.channels.cache.get(process.env.NOTIFICATIONS_CHANNEL_ID);
            if (!channel) return;
            
            const { embed, ping } = templates.getLiveNotification(streamInfo);
            
            await channel.send({ 
                content: ping, 
                embeds: [embed] 
            });
            
            logger.success(`Notification live envoyée: ${streamInfo.user_name}`);
        } catch (error) {
            logger.error('Erreur envoi notification live:', error);
        }
    }
    
    async sendOfflineNotification() {
        try {
            const channel = this.client.channels.cache.get(process.env.NOTIFICATIONS_CHANNEL_ID);
            if (!channel) return;
            
            let duration = null;
            if (this.liveStartTime) {
                duration = (Date.now() - this.liveStartTime.getTime()) / 1000;
            }
            
            const message = templates.getOfflineNotification(duration);
            
            await channel.send(message);
            
            logger.info('Notification fin de stream envoyée');
        } catch (error) {
            logger.error('Erreur envoi notification offline:', error);
        }
    }
    
    getUptime() {
        if (!this.isLive || !this.liveStartTime) return null;
        return Math.floor((Date.now() - this.liveStartTime.getTime()) / 1000);
    }
    
    isStreamLive() {
        return this.isLive;
    }
    
    getCurrentStreamInfo() {
        return this.currentStreamInfo;
    }
    
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
}

module.exports = new TwitchNotifications();