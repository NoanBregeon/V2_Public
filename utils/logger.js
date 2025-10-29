/**
 * Système de logs avancé et structuré
 * Logs détaillés, rotation automatique, et monitoring
 */

const fs = require('fs').promises;
const path = require('path');

class AdvancedLogger {
    constructor() {
        this.logDir = path.join(__dirname, '../logs');
        this.logFiles = {
            security: 'security.log',
            twitch: 'twitch.log',
            voice: 'voice.log',
            moderation: 'moderation.log',
            system: 'system.log',
            analytics: 'analytics.log',
            error: 'error.log',
            combined: 'combined.log'
        };
        
        this.logLevels = {
            ERROR: 0,
            WARN: 1,
            INFO: 2,
            DEBUG: 3
        };
        
        this.currentLogLevel = process.env.LOG_LEVEL || 'INFO';
        this.maxLogSize = 10 * 1024 * 1024; // 10MB
        this.maxLogFiles = 7; // Garder 7 fichiers rotationnés
        
        this.initializeLogger();
    }

    async initializeLogger() {
        try {
            await fs.mkdir(this.logDir, { recursive: true });
            console.log('📝 Système de logs initialisé');
        } catch (error) {
            console.error('❌ Erreur initialisation logs:', error);
        }
    }

    async log(level, category, message, metadata = {}) {
        if (this.logLevels[level] > this.logLevels[this.currentLogLevel]) {
            return; // Ne pas logger si le niveau est trop bas
        }

        const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
        const userId = metadata.userId || 'System';
        const guildId = metadata.guildId || 'Unknown';
        const extra = metadata.extra ? ` | ${JSON.stringify(metadata.extra)}` : '';
        
        const logEntry = `[${timestamp}] [${level}] [${category.toUpperCase()}] [${userId}] [${guildId}] ${message}${extra}\n`;
        
        try {
            // Écrire dans le fichier spécifique
            await this.writeToFile(category, logEntry);
            
            // Écrire dans le fichier combiné
            await this.writeToFile('combined', logEntry);
            
            // Afficher en console si DEBUG
            if (process.env.DEBUG === 'true' || level === 'ERROR') {
                console.log(logEntry.trim());
            }
        } catch (error) {
            console.error('❌ Erreur écriture log:', error);
        }
    }

    async writeToFile(category, logEntry) {
        const fileName = this.logFiles[category] || this.logFiles.system;
        const filePath = path.join(this.logDir, fileName);
        
        try {
            // Vérifier la taille du fichier pour rotation
            try {
                const stats = await fs.stat(filePath);
                if (stats.size > this.maxLogSize) {
                    await this.rotateLogFile(filePath);
                }
            } catch (error) {
                // Fichier n'existe pas encore, normal
            }
            
            await fs.appendFile(filePath, logEntry);
        } catch (error) {
            console.error(`❌ Erreur écriture log ${category}:`, error);
        }
    }

    async rotateLogFile(filePath) {
        try {
            const dir = path.dirname(filePath);
            const baseName = path.basename(filePath, '.log');
            
            // Décaler les anciens fichiers
            for (let i = this.maxLogFiles - 1; i >= 1; i--) {
                const oldFile = path.join(dir, `${baseName}.${i}.log`);
                const newFile = path.join(dir, `${baseName}.${i + 1}.log`);
                
                try {
                    await fs.rename(oldFile, newFile);
                } catch (error) {
                    // Fichier n'existe pas, continuer
                }
            }
            
            // Renommer le fichier actuel
            const rotatedFile = path.join(dir, `${baseName}.1.log`);
            await fs.rename(filePath, rotatedFile);
            
            console.log(`🔄 Rotation log: ${baseName}.log`);
        } catch (error) {
            console.error('❌ Erreur rotation log:', error);
        }
    }

    // Méthodes de logging spécialisées
    security(message, metadata = {}) {
        return this.log('WARN', 'security', message, metadata);
    }

    twitch(level, message, metadata = {}) {
        return this.log(level, 'twitch', message, metadata);
    }

    voice(message, metadata = {}) {
        return this.log('INFO', 'voice', message, metadata);
    }

    moderation(message, metadata = {}) {
        return this.log('INFO', 'moderation', message, metadata);
    }

    system(level, message, metadata = {}) {
        return this.log(level, 'system', message, metadata);
    }

    analytics(message, metadata = {}) {
        return this.log('INFO', 'analytics', message, metadata);
    }

    error(message, error, metadata = {}) {
        const errorDetails = error ? {
            message: error.message,
            stack: error.stack,
            ...error
        } : null;
        
        return this.log('ERROR', 'error', message, {
            ...metadata,
            extra: errorDetails
        });
    }

    // Méthodes d'analyse
    async getLogStats() {
        try {
            const stats = {};
            
            for (const [category, fileName] of Object.entries(this.logFiles)) {
                const filePath = path.join(this.logDir, fileName);
                try {
                    const fileStats = await fs.stat(filePath);
                    stats[category] = {
                        size: fileStats.size,
                        modified: fileStats.mtime,
                        exists: true
                    };
                } catch (error) {
                    stats[category] = { exists: false };
                }
            }
            
            return stats;
        } catch (error) {
            console.error('❌ Erreur statistiques logs:', error);
            return {};
        }
    }

    async searchLogs(category, searchTerm, maxResults = 50) {
        try {
            const fileName = this.logFiles[category];
            if (!fileName) return [];
            
            const filePath = path.join(this.logDir, fileName);
            const content = await fs.readFile(filePath, 'utf8');
            
            const lines = content.split('\n')
                .filter(line => line.includes(searchTerm))
                .slice(-maxResults)
                .reverse();
            
            return lines;
        } catch (error) {
            console.error('❌ Erreur recherche logs:', error);
            return [];
        }
    }

    async cleanOldLogs() {
        try {
            const files = await fs.readdir(this.logDir);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - 30); // 30 jours
            
            let cleaned = 0;
            for (const file of files) {
                const filePath = path.join(this.logDir, file);
                const stats = await fs.stat(filePath);
                
                if (stats.mtime < cutoffDate && file.includes('.log')) {
                    await fs.unlink(filePath);
                    cleaned++;
                }
            }
            
            if (cleaned > 0) {
                console.log(`🧹 ${cleaned} anciens logs supprimés`);
            }
        } catch (error) {
            console.error('❌ Erreur nettoyage logs:', error);
        }
    }
}

// Instance globale
const logger = new AdvancedLogger();

// Nettoyage automatique quotidien
setInterval(() => {
    logger.cleanOldLogs();
}, 24 * 60 * 60 * 1000);

module.exports = logger;
