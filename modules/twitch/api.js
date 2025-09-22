const axios = require('axios');
const logger = require('../utils/logger');
const helpers = require('../utils/helpers');

class TwitchAPI {
    constructor() {
        this.streamerId = null;
        this.streamerData = null;
        this.lastStreamInfo = null;
        this.baseUrl = 'https://api.twitch.tv/helix';
        this.headers = {
            'Client-ID': process.env.TWITCH_CLIENT_ID,
            'Authorization': `Bearer ${process.env.TWITCH_USER_TOKEN}`
        };
    }
    
    async getStreamerId() {
        if (this.streamerId) return this.streamerId;
        
        try {
            const response = await helpers.retryOperation(async () => {
                return axios.get(`${this.baseUrl}/users?login=${process.env.STREAMER_USERNAME}`, {
                    headers: this.headers
                });
            });
            
            if (!response.data.data.length) {
                throw new Error(`Streamer "${process.env.STREAMER_USERNAME}" non trouvé`);
            }
            
            this.streamerData = response.data.data[0];
            this.streamerId = this.streamerData.id;
            
            logger.success(`Streamer trouvé: ${this.streamerData.display_name} (ID: ${this.streamerId})`);
            
            return this.streamerId;
        } catch (error) {
            logger.error('Erreur récupération streamer ID:', error);
            throw error;
        }
    }
    
    async getVIPs() {
        try {
            const streamerId = await this.getStreamerId();
            
            const response = await helpers.retryOperation(async () => {
                return axios.get(`${this.baseUrl}/channels/vips?broadcaster_id=${streamerId}`, {
                    headers: this.headers
                });
            });
            
            const vips = response.data.data.map(vip => vip.user_name.toLowerCase());
            logger.debug(`📋 ${vips.length} VIP(s) trouvé(s) sur Twitch`);
            
            return vips;
        } catch (error) {
            logger.error('Erreur récupération VIPs Twitch:', error);
            return [];
        }
    }
    
    async getModerators() {
        try {
            const streamerId = await this.getStreamerId();
            
            const response = await helpers.retryOperation(async () => {
                return axios.get(`${this.baseUrl}/moderation/moderators?broadcaster_id=${streamerId}`, {
                    headers: this.headers
                });
            });
            
            const moderators = response.data.data.map(mod => mod.user_name.toLowerCase());
            logger.debug(`📋 ${moderators.length} modérateur(s) trouvé(s) sur Twitch`);
            
            return moderators;
        } catch (error) {
            logger.error('Erreur récupération modérateurs Twitch:', error);
            return [];
        }
    }
    
    async addVIP(username) {
        try {
            const streamerId = await this.getStreamerId();
            
            // Récupération de l'ID utilisateur
            const userResponse = await helpers.retryOperation(async () => {
                return axios.get(`${this.baseUrl}/users?login=${username}`, {
                    headers: this.headers
                });
            });
            
            if (!userResponse.data.data.length) {
                throw new Error(`Utilisateur "${username}" non trouvé sur Twitch`);
            }
            
            const userId = userResponse.data.data[0].id;
            
            // Ajout VIP
            await helpers.retryOperation(async () => {
                return axios.post(`${this.baseUrl}/channels/vips`, {
                    user_id: userId,
                    broadcaster_id: streamerId
                }, {
                    headers: this.headers
                });
            });
            
            logger.success(`VIP ajouté sur Twitch: ${username}`);
            return true;
        } catch (error) {
            if (error.response?.status === 422) {
                logger.warn(`VIP ${username} déjà présent ou limite atteinte`);
                throw new Error(`${username} est déjà VIP ou limite atteinte`);
            } else {
                logger.error(`Erreur ajout VIP ${username}:`, error.message);
                throw error;
            }
        }
    }
    
    async removeVIP(username) {
        try {
            const streamerId = await this.getStreamerId();
            
            const userResponse = await helpers.retryOperation(async () => {
                return axios.get(`${this.baseUrl}/users?login=${username}`, {
                    headers: this.headers
                });
            });
            
            if (!userResponse.data.data.length) {
                throw new Error(`Utilisateur "${username}" non trouvé sur Twitch`);
            }
            
            const userId = userResponse.data.data[0].id;
            
            await helpers.retryOperation(async () => {
                return axios.delete(`${this.baseUrl}/channels/vips?user_id=${userId}&broadcaster_id=${streamerId}`, {
                    headers: this.headers
                });
            });
            
            logger.success(`VIP retiré de Twitch: ${username}`);
            return true;
        } catch (error) {
            logger.error(`Erreur suppression VIP ${username}:`, error.message);
            throw error;
        }
    }
    
    async addModerator(username) {
        try {
            const streamerId = await this.getStreamerId();
            
            const userResponse = await helpers.retryOperation(async () => {
                return axios.get(`${this.baseUrl}/users?login=${username}`, {
                    headers: this.headers
                });
            });
            
            if (!userResponse.data.data.length) {
                throw new Error(`Utilisateur "${username}" non trouvé sur Twitch`);
            }
            
            const userId = userResponse.data.data[0].id;
            
            await helpers.retryOperation(async () => {
                return axios.post(`${this.baseUrl}/moderation/moderators`, {
                    user_id: userId,
                    broadcaster_id: streamerId
                }, {
                    headers: this.headers
                });
            });
            
            logger.success(`Modérateur ajouté sur Twitch: ${username}`);
            return true;
        } catch (error) {
            logger.error(`Erreur ajout modérateur ${username}:`, error.message);
            throw error;
        }
    }
    
    async removeModerator(username) {
        try {
            const streamerId = await this.getStreamerId();
            
            const userResponse = await helpers.retryOperation(async () => {
                return axios.get(`${this.baseUrl}/users?login=${username}`, {
                    headers: this.headers
                });
            });
            
            if (!userResponse.data.data.length) {
                throw new Error(`Utilisateur "${username}" non trouvé sur Twitch`);
            }
            
            const userId = userResponse.data.data[0].id;
            
            await helpers.retryOperation(async () => {
                return axios.delete(`${this.baseUrl}/moderation/moderators?user_id=${userId}&broadcaster_id=${streamerId}`, {
                    headers: this.headers
                });
            });
            
            logger.success(`Modérateur retiré de Twitch: ${username}`);
            return true;
        } catch (error) {
            logger.error(`Erreur suppression modérateur ${username}:`, error.message);
            throw error;
        }
    }
    
    async banUser(username, reason = 'Comportement inapproprié', duration = null) {
        try {
            const streamerId = await this.getStreamerId();
            
            const userResponse = await helpers.retryOperation(async () => {
                return axios.get(`${this.baseUrl}/users?login=${username}`, {
                    headers: this.headers
                });
            });
            
            if (!userResponse.data.data.length) {
                throw new Error(`Utilisateur "${username}" non trouvé sur Twitch`);
            }
            
            const userId = userResponse.data.data[0].id;
            
            const banData = {
                broadcaster_id: streamerId,
                moderator_id: streamerId,
                user_id: userId,
                reason: reason
            };
            
            if (duration) {
                banData.duration = duration;
            }
            
            await helpers.retryOperation(async () => {
                return axios.post(`${this.baseUrl}/moderation/bans`, banData, {
                    headers: this.headers
                });
            });
            
            const actionType = duration ? `timeout (${duration}s)` : 'ban';
            logger.success(`${actionType} appliqué sur Twitch: ${username} - ${reason}`);
            return true;
        } catch (error) {
            logger.error(`Erreur ban/timeout ${username}:`, error.message);
            throw error;
        }
    }
    
    async unbanUser(username) {
        try {
            const streamerId = await this.getStreamerId();
            
            const userResponse = await helpers.retryOperation(async () => {
                return axios.get(`${this.baseUrl}/users?login=${username}`, {
                    headers: this.headers
                });
            });
            
            if (!userResponse.data.data.length) {
                throw new Error(`Utilisateur "${username}" non trouvé sur Twitch`);
            }
            
            const userId = userResponse.data.data[0].id;
            
            await helpers.retryOperation(async () => {
                return axios.delete(`${this.baseUrl}/moderation/bans?broadcaster_id=${streamerId}&moderator_id=${streamerId}&user_id=${userId}`, {
                    headers: this.headers
                });
            });
            
            logger.success(`Unban appliqué sur Twitch: ${username}`);
            return true;
        } catch (error) {
            logger.error(`Erreur unban ${username}:`, error.message);
            throw error;
        }
    }
    
    async getStreamInfo() {
        try {
            const streamerId = await this.getStreamerId();
            
            const response = await helpers.retryOperation(async () => {
                return axios.get(`${this.baseUrl}/streams?user_id=${streamerId}`, {
                    headers: this.headers
                });
            });
            
            const streamInfo = response.data.data[0] || null;
            this.lastStreamInfo = streamInfo;
            
            return streamInfo;
        } catch (error) {
            logger.error('Erreur récupération info stream:', error);
            return null;
        }
    }
    
    async getChannelInfo() {
        try {
            const streamerId = await this.getStreamerId();
            
            const response = await helpers.retryOperation(async () => {
                return axios.get(`${this.baseUrl}/channels?broadcaster_id=${streamerId}`, {
                    headers: this.headers
                });
            });
            
            return response.data.data[0] || null;
        } catch (error) {
            logger.error('Erreur récupération info chaîne:', error);
            return null;
        }
    }
    
    async searchUser(username) {
        try {
            const response = await helpers.retryOperation(async () => {
                return axios.get(`${this.baseUrl}/users?login=${username}`, {
                    headers: this.headers
                });
            });
            
            return response.data.data[0] || null;
        } catch (error) {
            logger.error(`Erreur recherche utilisateur ${username}:`, error);
            return null;
        }
    }
}

module.exports = new TwitchAPI();