# 🤖 Bot Discord V2 - Système Modulaire Avancé

[![Discord.js](https://img.shields.io/badge/discord.js-v14.14.1-blue.svg)](https://discord.js.org/)
[![Node.js](https://img.shields.io/badge/node.js-18+-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-Private-red.svg)]()

**Bot Discord moderne avec intégration Twitch complète, système vocal avancé et modération intelligente.**

---

## 🚀 **Fonctionnalités Principales**

### 🎤 **Système Vocal Intelligent**
- **Salons temporaires** - Création automatique de salons vocaux personnalisés
- **Gestion propriétaire** - Contrôle complet (renommer, limiter, verrouiller)
- **Commandes rapides** - `!rename`, `!lock`, `!unlock` dans le chat
- **Transfert de propriété** - `/voice transfer` pour changer de propriétaire

### 🎮 **Intégration Twitch Complète**
- **Notifications live automatiques** - Embed riche + bouton interactif
- **Chat relay Twitch → Discord** - Messages en temps réel (filtrage anti-bots)
- **Gestion VIP/Modérateurs** - Commandes Discord pour Twitch
- **Système de notifications** - Rôle automatique avec bouton toggle

### 🛡️ **Modération Avancée**
- **Sanctions graduées** - Ban, kick, timeout, warn
- **Logs détaillés** - Historique complet des actions
- **Permissions granulaires** - Système de rôles sécurisé
- **Anti-spam intégré** - Protection automatique

### ⚙️ **Architecture Modulaire**
- **Hot-reload** - Rechargement des modules sans redémarrage
- **Système de tests** - `/test` pour vérifier chaque composant
- **Gestion d'erreurs** - Retry automatique + logs + notifications admin

---

## 📋 **Commandes Disponibles**

### 🎤 **Commandes Vocales**
```
/voice rename <nom>        - Renommer votre salon vocal
/voice limit <nombre>      - Limiter les utilisateurs (0 = illimité)
/voice lock               - Verrouiller le salon
/voice unlock             - Déverrouiller le salon
/voice transfer <user>    - Transférer la propriété

!rename <nom>            - Commande rapide (propriétaires uniquement)
!lock                    - Verrouillage rapide
!unlock                  - Déverrouillage rapide
```

### 🎮 **Commandes Twitch** *(Administrateurs uniquement)*
```
/addvip <username>       - Ajouter un VIP Twitch
/removevip <username>    - Retirer un VIP Twitch
/addmodo <username>      - Ajouter un modérateur Twitch
/removemodo <username>   - Retirer un modérateur Twitch
```

### 🛡️ **Commandes Modération** *(Modérateurs+)*
```
/moderation ban <user> [raison]      - Bannir un utilisateur
/moderation kick <user> [raison]     - Expulser un utilisateur
/moderation timeout <user> <min>     - Timeout temporaire
/moderation warn <user> [raison]     - Avertir un utilisateur
```

### 🔧 **Commandes Admin** *(Administrateurs uniquement)*
```
/test commands           - Tester toutes les commandes
/test modules            - Vérifier les modules
/test permissions <user> - Tester les permissions
/test voice             - Diagnostiquer le système vocal
/test twitch            - Vérifier l'intégration Twitch

/admin reload-commands   - Recharger les commandes
/admin clean-commands    - Nettoyer les doublons
/admin status           - Statut du bot
```

### 📚 **Commandes Générales**
```
/help                   - Afficher l'aide
/ping                   - Vérifier la latence
```

---

## ⚡ **Installation & Configuration**

### **1. Prérequis**
```bash
Node.js 18+ 
npm ou yarn
Git
```

### **2. Installation**
```bash
git clone https://github.com/votre-username/bot-discord-v2.git
cd bot-discord-v2/V2_Public
npm install
```

### **3. Configuration**
Créez un fichier `.env` :
```env
# Discord
DISCORD_TOKEN=votre_token_discord
DISCORD_CLIENT_ID=votre_client_id
GUILD_ID=id_de_votre_serveur

# Twitch
TWITCH_CLIENT_ID=votre_client_id_twitch
TWITCH_USER_TOKEN=votre_token_utilisateur_twitch
STREAMER_USERNAME=votre_pseudo_twitch
TWITCH_BOT_USERNAME=nom_du_bot_twitch
TWITCH_BOT_TOKEN=oauth:token_bot_twitch

# Canaux Discord
LIVE_NOTIFICATIONS_CHANNEL_ID=id_canal_notifications
VOICE_INSTRUCTIONS_CHANNEL_ID=id_canal_instructions
VOICE_LOGS_CHANNEL_ID=id_canal_logs_vocaux
VOICE_CATEGORY_ID=id_categorie_vocale
CREATE_VOICE_CHANNEL_ID=id_canal_creation_vocal

# Rôles
VIP_ROLE_ID=id_role_vip
MODERATOR_ROLE_ID=id_role_moderateur
DEFAULT_ROLE_ID=id_role_par_defaut
```

### **4. Démarrage**
```bash
# Démarrage normal
npm start

# Avec PM2 (recommandé pour production)
npm run pm2:start

# Mode développement
npm run dev
```

---

## 🏗️ **Architecture du Projet**

```
V2_Public/
├── 📁 commands/          # Commandes slash
│   ├── help.js
│   ├── voice.js
│   ├── test.js
│   └── twitch-commands.js
├── 📁 handlers/          # Modules principaux
│   ├── commandHandler.js
│   ├── voiceManager.js
│   ├── moderationManager.js
│   ├── welcomeManager.js
│   └── interactionHandler.js
├── 📁 services/          # Services externes
│   └── twitchBridge.js
├── 📁 utils/             # Utilitaires
│   ├── permissions.js
│   └── testRunner.js
├── 📁 data/              # Données persistantes
├── 📁 logs/              # Journaux
├── index.js              # Point d'entrée
├── package.json
└── .env                  # Configuration
```

---

## 🎯 **Système de Permissions**

### **Niveaux d'Accès**
- 👑 **Administrateur** - Toutes les commandes + gestion Twitch
- 🛡️ **Modérateur** - Modération + commandes de base
- 👤 **Membre** - Commandes vocales + aide

### **Commandes Twitch Sécurisées**
Les commandes `/addvip`, `/removevip`, `/addmodo`, `/removemodo` sont **strictement réservées aux administrateurs Discord** pour éviter les abus.

---

## 🔧 **Configuration Avancée**

### **Variables d'Environnement Optionnelles**
```env
# Multi-serveurs
STAFF_GUILD_ID=id_serveur_staff
COMMUNITY_GUILD_ID=id_serveur_communaute

# Chat Relay
TWITCH_RELAY_CHANNEL_ID=id_canal_relay
TWITCH_REMOVE_FORMAT=true

# Développement
DEBUG=false
NODE_ENV=production
CLEAN_COMMANDS_ON_START=false
RUN_TESTS_ON_START=false
```

### **Permissions Discord Requises**
- ✅ Manage Roles
- ✅ Manage Channels
- ✅ Send Messages
- ✅ Use Slash Commands
- ✅ Connect & Speak
- ✅ Move Members
- ✅ Ban Members
- ✅ Kick Members
- ✅ Moderate Members

---

## 🚨 **Dépannage**

### **Problèmes Courants**

**❌ Commandes introuvables**
```bash
# Nettoyer et recharger
/admin clean-commands
# Redémarrer le bot
```

**❌ Erreur API Twitch**
```bash
# Vérifier les tokens
/test twitch
# Régénérer le token si expiré
```

**❌ Salons vocaux non créés**
```bash
# Diagnostiquer
/test voice
# Vérifier les permissions du bot
```

### **Tests de Santé**
```bash
/test modules     # Vérifier tous les modules
/test commands    # Tester toutes les commandes
/test permissions # Vérifier vos permissions
```

---

## 📊 **Monitoring & Logs**

### **Logs Automatiques**
- 🔍 **Erreurs système** - `logs/err.log`
- 📝 **Activité générale** - `logs/out.log`
- 🎮 **Erreurs Twitch** - `logs/twitch-errors.log`

### **Métriques en Temps Réel**
- 📈 Latence API Discord
- 🎤 Salons vocaux actifs
- 🎮 Statut Twitch
- 👥 Utilisateurs connectés

---

## 🛡️ **Anti-Spam Intelligent** *(Nouveau)*
- **Détection multi-critères** - Messages identiques, flood, mentions excessives
- **Sanctions graduées** - Mute progressif puis ban automatique
- **Patterns suspects** - Liens malveillants, spam d'emojis, contenu indésirable
- **Exclusions intelligentes** - Admins, VIPs, modérateurs automatiquement exclus
- **Logs détaillés** - Traçabilité complète des actions anti-spam

---

## 📊 **Système de Logs Avancé**

### **Types de Logs Détaillés**
- 🔐 **Security Logs** - `logs/security.log`
  - Tentatives d'accès non autorisées
  - Violations de permissions
  - Actions anti-spam détaillées
  - Connexions/déconnexions suspectes

- 🎮 **Twitch Integration** - `logs/twitch.log`
  - API calls et réponses
  - Erreurs de connexion
  - Changements de statut stream
  - Actions VIP/Modérateur

- 🎤 **Voice Activities** - `logs/voice.log`
  - Création/suppression salons temporaires
  - Transferts de propriété
  - Modifications de permissions
  - Statistiques d'utilisation

- 🛡️ **Moderation Actions** - `logs/moderation.log`
  - Bans, kicks, timeouts, warns
  - Actions automatiques vs manuelles
  - Raisons détaillées
  - Historique des sanctions

- ⚙️ **System Operations** - `logs/system.log`
  - Démarrages/arrêts de modules
  - Rechargements de commandes
  - Erreurs critiques
  - Performance metrics

- 📊 **Analytics** - `logs/analytics.log`
  - Utilisation des commandes
  - Statistiques utilisateurs
  - Métriques de performance
  - Tendances d'activité

### **Format de Logs Structuré**
```
[2024-12-XX HH:MM:SS] [LEVEL] [MODULE] [USER:ID] [GUILD:ID] Message détaillé
[2024-12-XX 14:30:15] [WARN] [ANTISPAM] [User#1234:123456789] [Guild:987654321] Spam détecté: 3 messages identiques en 15s
[2024-12-XX 14:30:16] [INFO] [ANTISPAM] [User#1234:123456789] [Guild:987654321] Action: Timeout 5min appliqué
[2024-12-XX 14:35:20] [ERROR] [TWITCH] [System] API Rate limit exceeded, retry in 60s
```

### **Rotation et Archivage**
- ✅ Rotation quotidienne des logs
- ✅ Compression automatique (7 jours)
- ✅ Archivage long terme (30 jours)
- ✅ Nettoyage automatique des anciens logs

### **Monitoring en Temps Réel**
- 📈 Dashboard intégré `/admin dashboard`
- 🚨 Alertes automatiques pour erreurs critiques
- 📊 Graphiques d'utilisation
- ⚡ Métriques de performance live

---

## 🤝 **Contribution**

### **Guidelines**
1. 🍴 Fork le projet
2. 🌿 Créer une branche feature (`git checkout -b feature/nouvelle-fonctionnalite`)
3. 💻 Coder vos modifications
4. ✅ Tester avec `/test commands`
5. 📤 Commit & Push
6. 🔀 Créer une Pull Request

### **Structure des Commits**
```
feat: nouvelle fonctionnalité
fix: correction de bug
docs: mise à jour documentation
style: formatting, point-virgules manquants, etc.
refactor: refactoring du code
test: ajout de tests
chore: mise à jour build, dépendances, etc.
```

---

## 📈 **Roadmap**

### **v2.1** *(Prochaine)*
- [ ] 🌐 Dashboard web
- [ ] 📊 Système XP/Niveaux
- [ ] 🎵 Commandes musicales
- [ ] 🤖 Auto-modération IA

### **v2.2** *(Futur)*
- [ ] 💰 Économie virtuelle
- [ ] 🎫 Système de tickets
- [ ] 📅 Événements programmés
- [ ] 🔗 API publique

---

## 📄 **Licence & Légal**

- **Licence :** Propriétaire
- **Terms of Service :** [TERMS.md](./TERMS.md)
- **Privacy Policy :** [PRIVACY.md](./PRIVACY.md)

---

## 📞 **Support & Contact**

- 💬 **Discord :** Contactez les administrateurs
- 🐛 **Issues :** [GitHub Issues](https://github.com/votre-username/bot-discord-v2/issues)
- 📧 **Email :** votre.email@example.com

---

## ⭐ **Remerciements**

Merci à tous les contributeurs et à la communauté Discord.js !

---

**Bot développé avec ❤️ par Fury Nocturne 2.0**

*Dernière mise à jour : Décembre 2024*
