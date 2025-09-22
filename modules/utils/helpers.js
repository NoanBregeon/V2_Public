const logger = require('./logger');

class Helpers {
    static async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    static formatUptime(seconds) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        const parts = [];
        if (days > 0) parts.push(`${days}j`);
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
        
        return parts.join(' ');
    }
    
    static async retryOperation(operation, maxRetries = 3, delay = 1000) {
        let lastError;
        
        for (let i = 0; i < maxRetries; i++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                logger.warn(`Tentative ${i + 1}/${maxRetries} échouée: ${error.message}`);
                
                if (i < maxRetries - 1) {
                    await this.sleep(delay * Math.pow(2, i)); // Backoff exponentiel
                }
            }
        }
        
        throw lastError;
    }
    
    static isValidDiscordId(id) {
        return /^\d{17,19}$/.test(id);
    }
    
    static formatNumber(num) {
        return new Intl.NumberFormat('fr-FR').format(num);
    }
    
    static capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    }
    
    static truncateText(text, maxLength = 100) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
    }
    
    static randomChoice(array) {
        return array[Math.floor(Math.random() * array.length)];
    }
    
    static parseTimeString(timeStr) {
        const units = {
            's': 1,
            'm': 60,
            'h': 3600,
            'd': 86400,
            'w': 604800
        };
        
        const match = timeStr.match(/^(\d+)([smhdw])$/i);
        if (!match) return null;
        
        const [, amount, unit] = match;
        return parseInt(amount) * (units[unit.toLowerCase()] || 1);
    }
}

module.exports = Helpers;