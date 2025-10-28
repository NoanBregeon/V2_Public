/**
 * Système de test automatique pour le bot
 */

class TestRunner {
    constructor(client) {
        this.client = client;
        this.results = [];
    }

    async runAllTests() {
        console.log('🧪 Démarrage des tests automatiques...');
        
        this.results = [];
        
        await this.testModules();
        await this.testCommands();
        await this.testConfiguration();
        
        this.displayResults();
        return this.results;
    }

    async testModules() {
        const moduleManager = this.client.moduleManager;
        const expectedModules = ['commandHandler', 'voiceManager', 'moderationManager', 'welcomeManager', 'twitchBridge'];
        
        for (const moduleName of expectedModules) {
            const module = moduleManager?.getModule(moduleName);
            
            if (!module) {
                this.addResult('❌', `Module ${moduleName}`, 'Non chargé');
            } else if (typeof module.initialize !== 'function') {
                this.addResult('⚠️', `Module ${moduleName}`, 'Pas de méthode initialize');
            } else {
                this.addResult('✅', `Module ${moduleName}`, 'OK');
            }
        }
    }

    async testCommands() {
        const commandHandler = this.client.moduleManager?.getModule('commandHandler');
        
        if (!commandHandler) {
            this.addResult('❌', 'CommandHandler', 'Non disponible');
            return;
        }

        const commands = commandHandler.commands;
        
        for (const [name, command] of commands) {
            if (!command.data || !command.execute) {
                this.addResult('❌', `Commande /${name}`, 'Structure invalide');
            } else if (typeof command.execute !== 'function') {
                this.addResult('❌', `Commande /${name}`, 'Execute n\'est pas une fonction');
            } else {
                this.addResult('✅', `Commande /${name}`, 'OK');
            }
        }
    }

    async testConfiguration() {
        const moduleManager = this.client.moduleManager;
        const voiceManager = moduleManager?.getModule('voiceManager');
        
        if (voiceManager) {
            const config = voiceManager.config;
            const requiredChannels = [
                { name: 'createVoiceChannelId', value: config.createVoiceChannelId },
                { name: 'voiceCategoryId', value: config.voiceCategoryId }
            ];
            
            for (const { name, value } of requiredChannels) {
                if (!value) {
                    this.addResult('⚠️', `Config ${name}`, 'Non configuré');
                } else {
                    try {
                        await this.client.channels.fetch(value);
                        this.addResult('✅', `Config ${name}`, 'Canal trouvé');
                    } catch (error) {
                        this.addResult('❌', `Config ${name}`, 'Canal introuvable');
                    }
                }
            }
        }
    }

    addResult(status, component, message) {
        this.results.push({ status, component, message, timestamp: new Date() });
    }

    displayResults() {
        console.log('\n📊 Résultats des tests:');
        console.log('='.repeat(50));
        
        const passed = this.results.filter(r => r.status === '✅').length;
        const warnings = this.results.filter(r => r.status === '⚠️').length;
        const failed = this.results.filter(r => r.status === '❌').length;
        
        for (const result of this.results) {
            console.log(`${result.status} ${result.component}: ${result.message}`);
        }
        
        console.log('='.repeat(50));
        console.log(`📈 Résumé: ${passed} réussis, ${warnings} avertissements, ${failed} échecs`);
        
        if (failed === 0) {
            console.log('🎉 Tous les tests sont passés!');
        } else {
            console.log('⚠️ Certains tests ont échoué. Vérifiez la configuration.');
        }
    }

    getHealthScore() {
        const total = this.results.length;
        if (total === 0) return 0;
        
        const passed = this.results.filter(r => r.status === '✅').length;
        const warnings = this.results.filter(r => r.status === '⚠️').length;
        
        return Math.round(((passed + warnings * 0.5) / total) * 100);
    }
}

module.exports = TestRunner;
