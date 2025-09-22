const fs = require('fs').promises;
const path = require('path');

class MessageManager {
    constructor() {
        this.messages = {};
        this.loaded = false;
        this.configPath = path.join(__dirname, '../config/messages.json');
    }

    async loadMessages() {
        try {
            const data = await fs.readFile(this.configPath, 'utf8');
            this.messages = JSON.parse(data);
            this.loaded = true;
            console.log('✅ Messages chargés avec succès');
            return true;
        } catch (error) {
            console.error('❌ Erreur chargement messages:', error);
            return false;
        }
    }

    getMessage(category, key) {
        if (!this.loaded) {
            console.warn('⚠️ Messages non chargés, chargement automatique...');
            this.loadMessages();
            return null;
        }

        try {
            if (!key && this.messages[category]) {
                return this.messages[category];
            }
            return this.messages[category]?.[key] || null;
        } catch (error) {
            console.error(`❌ Erreur récupération message ${category}.${key}:`, error);
            return null;
        }
    }

    getFormattedMessage(category, key, replacements = {}) {
        let message = this.getMessage(category, key);
        if (!message) return null;

        // Convertir en string pour faire les remplacements
        let result = typeof message === 'string' ? message : JSON.stringify(message);
        
        // Remplacer les variables
        for (const [key, value] of Object.entries(replacements)) {
            result = result.replace(new RegExp(`{${key}}`, 'g'), value);
        }

        // Reconvertir en objet si nécessaire
        if (typeof message !== 'string') {
            try {
                result = JSON.parse(result);
            } catch (error) {
                console.error('❌ Erreur parsing message formatté:', error);
                return null;
            }
        }

        return result;
    }

    async saveMessages() {
        try {
            await fs.writeFile(
                this.configPath, 
                JSON.stringify(this.messages, null, 2)
            );
            console.log('✅ Messages sauvegardés avec succès');
            return true;
        } catch (error) {
            console.error('❌ Erreur sauvegarde messages:', error);
            return false;
        }
    }

    setMessage(category, key, value) {
        if (!this.loaded) {
            console.warn('⚠️ Messages non chargés, chargement automatique...');
            this.loadMessages();
        }

        try {
            // Créer la catégorie si elle n'existe pas
            if (!this.messages[category]) {
                this.messages[category] = {};
            }
            
            // Définir la valeur
            if (key) {
                this.messages[category][key] = value;
            } else {
                this.messages[category] = value;
            }
            
            return true;
        } catch (error) {
            console.error(`❌ Erreur définition message ${category}.${key}:`, error);
            return false;
        }
    }

    // Vérifier si un message existe
    hasMessage(category, key) {
        if (!this.loaded) {
            console.warn('⚠️ Messages non chargés, chargement automatique...');
            this.loadMessages();
            return false;
        }

        try {
            if (!key) {
                return !!this.messages[category];
            }
            return !!this.messages[category]?.[key];
        } catch {
            return false;
        }
    }
}

module.exports = new MessageManager();
