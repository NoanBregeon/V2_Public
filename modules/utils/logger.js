const fs = require('fs');
const path = require('path');

const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

class Logger {
    static formatMessage(level, message, data = null) {
        const timestamp = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
        const emoji = {
            info: 'ℹ️',
            warn: '⚠️',
            error: '❌',
            success: '✅',
            debug: '🐛'
        };
        
        return `${emoji[level] || '📝'} [${timestamp}] [${level.toUpperCase()}] ${message}`;
    }
    
    static log(level, message, data = null) {
        const formattedMessage = this.formatMessage(level, message);
        
        console.log(formattedMessage);
        
        if (data) {
            console.log('📊 Data:', data);
        }
        
        // Écriture dans fichier
        try {
            const logFile = path.join(logsDir, `${new Date().toISOString().split('T')[0]}.log`);
            const fileMessage = data 
                ? `${formattedMessage}\nData: ${JSON.stringify(data, null, 2)}\n\n`
                : `${formattedMessage}\n`;
            
            fs.appendFileSync(logFile, fileMessage);
        } catch (error) {
            console.error('❌ Erreur écriture log:', error.message);
        }
    }
    
    static info(message, data) {
        this.log('info', message, data);
    }
    
    static warn(message, data) {
        this.log('warn', message, data);
    }
    
    static error(message, data) {
        this.log('error', message, data);
    }
    
    static success(message, data) {
        this.log('success', message, data);
    }
    
    static debug(message, data) {
        if (process.env.NODE_ENV === 'development') {
            this.log('debug', message, data);
        }
    }
}

module.exports = Logger;