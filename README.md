# Lyubot — Bot Discord & Twitch

*Développé par Fury Nocturne 2.0 – Projet V2 (BTS SIO SLAM)*

---

## Description

Lyubot est un bot Discord avec intégrations Twitch, conçu pour centraliser la modération, la gestion des événements de stream et l'automatisation des tâches communautaires.

Ce README décrit l'installation, la configuration et l'utilisation du bot. Si vous déployez ce bot en production, suivez attentivement la section Configuration (variables d'environnement) et la Politique de confidentialité (`PRIVACY.md`).

---

## Table des matières

1. [Prérequis](#prérequis)
2. [Installation rapide](#installation-rapide)
3. [Variables d'environnement](#variables-denvironnement)
4. [Démarrage](#démarrage)
5. [Structure du projet](#structure-du-projet)
6. [Fonctionnalités principales](#fonctionnalités-principales)
7. [Journalisation & Logs](#journalisation--logs)
8. [Contribution et développement](#contribution-et-développement)
9. [Licence privée](#licence-privée)
10. [Contact](#contact)

---

## Prérequis

- Node.js 18+ (le projet vise Node.js 20+)
- npm ou yarn
- Un bot Discord enregistré et son token

---

## Installation rapide

1. Clonez le dépôt :

```pwsh
git clone https://github.com/NoanBregeon/V2_Public.git
cd V2_Public
```

2. Installez les dépendances :

```pwsh
npm install
```

3. Créez un fichier `.env` basé sur `.env.example` (s'il existe) ou configurez manuellement les variables listées plus bas.

---

## Variables d'environnement

Les variables essentielles détectées dans le projet :

- `DISCORD_TOKEN` (obligatoire) — token du bot Discord
- `DISCORD_CLIENT_ID` (recommandé) — client id de l'application
- `GUILD_ID`, `STAFF_GUILD_ID`, `COMMUNITY_GUILD_ID` — IDs de guildes utilisés pour l'enregistrement de commandes
- `CLEAN_COMMANDS_ON_START` — si `true`, supprime les commandes à la startup
- `DEBUG` — mode debug (`true`/`false`)

Ajoutez d'autres variables selon vos services (webhooks de logs, clés Twitch, etc.).

---

## Démarrage

Pour lancer le bot en local :

```pwsh
node index.js
```

Ou avec nodemon pour le développement :

```pwsh
npx nodemon index.js
```

Le bot s'authentifiera via `DISCORD_TOKEN` et initialisera les handlers (commands, tickets, voice rooms, etc.).

---

## Structure du projet (aperçu)

Fichiers et dossiers importants :

- `index.js` — point d'entrée, initialisation du client Discord
- `commands/` — commandes du bot (slash commands, utilitaires)
- `handlers/` — handlers d'événements (ex: `commandHandler.js`, `logEvents.js`)
- `services/` — services réutilisables (logs Discord, ticketService, twitch, voiceRooms)
- `utils/` — fonctions utilitaires (guards, time, ...)
- `data/` — données statiques/config (ex: `welcome.json`)
- `PRIVACY.md`, `TERMS.md` — documentation et politique

---

## Fonctionnalités principales

- Gestion complète de modération (ban, kick, mute, warn)
- Système de tickets et gestion des salons temporaires
- Intégration Twitch : notifications, modération Twitch depuis Discord
- Enregistrement d'événements et logs (via `handlers/logEvents.js`)

---

## Journalisation & Logs

Le projet utilise un service interne `services/logsDiscord` pour envoyer des embeds de logs vers un canal ou webhook configuré. Vérifiez la configuration avant d'activer la journalisation publique.

---

## Contribution et développement

Si vous souhaitez contribuer :

1. Forkez le dépôt
2. Créez une branche feature : `git checkout -b feat/ma-fonction`
3. Faites vos modifications et tests
4. Ouvrez une Pull Request décrite

Respectez les règles suivantes :
- Ne pas commiter de tokens, secrets ou `.env`
- Documenter les nouvelles variables d'environnement
- Ajouter/mettre à jour les tests si nécessaire

---

## Licence privée

Ce projet est distribué sous une licence privée (voir `LICENSE_PRIVEE.md`).

Résumé :
- Usage interne et déploiement autorisés sauf mention contraire
- Redistribution, revente ou publication publique interdite sans accord explicite
- Voir `LICENSE_PRIVEE.md` pour le texte complet et les conditions légales

---

## Sécurité

- Ne partagez jamais votre `DISCORD_TOKEN` ou vos clés Twitch
- Restreignez les permissions du bot au strict nécessaire
- Surveillez et faites tourner les tokens régulièrement

---

## Contact

- Mainteneur : Fury Nocturne 2.0 / NoanBregeon
- Repo : https://github.com/NoanBregeon/V2_Public
- Pour questions légales sur la licence privée, consultez un avocat (ce fichier est un template, pas un avis légal).

---

Merci d'utiliser Lyubot — si tu veux, je peux aussi :

- ajouter un `CONTRIBUTING.md` détaillé
- générer un `.env.example`
- vérifier `services/logsDiscord` et s'assurer qu'un webhook est configuré

---

*(README généré automatiquement — adapte les sections `Contact` et `Licence` selon tes besoins.)*
# Lyubot — Bot Discord & Twitch  
*Développé par Fury Nocturne 2.0 – Projet BTS SIO SLAM (E6)*  

---

## 1. Présentation du projet / Project Overview

**Lyubot** est un bot Discord et Twitch conçu pour automatiser la modération, la gestion communautaire et la communication entre les deux plateformes.  
Le projet a été développé dans le cadre du **BTS SIO option SLAM**, afin d’illustrer les compétences liées au développement d’applications connectées et à la gestion d’API externes.

**Langues** : Français (principal) / Anglais (technical terms)  
**Public visé** : Administrateurs, modérateurs et streamers souhaitant centraliser leurs outils de gestion.

---

## 2. Objectifs pédagogiques et techniques

- Mettre en œuvre un système complet de gestion entre **Discord** et **Twitch**.  
- Démontrer l’intégration d’API externes (Twitch Helix, Discord.js).  
- Gérer la sécurité, les permissions et la journalisation.  
- Illustrer les compétences du référentiel BTS SIO SLAM : développement, déploiement, maintenance et sécurité.

---

## 3. Fonctionnalités principales / Main Features

### Discord
- Gestion des rôles (VIP, Modérateurs, Admins).  
- Commandes de modération (/mute, /kick, /ban, /warn, etc.).  
- Système de tickets avec création automatique de salons.  
- Création dynamique de salons vocaux temporaires.  
- Système de bienvenue configurable.  
- Journalisation en direct (logs des actions, création/suppression de salons, départs, etc.).

### Twitch
- Gestion des modérateurs et VIP via commandes Discord.  
- Commandes Twitch (/twitchaddmod, /twitchban, etc.) avec connexion Helix API.  
- Système de notifications “Live” vers Discord.  
- Relais de chat Twitch → Discord.  
- Liste des bannis et des modérateurs sous forme d’embed interactif (pagination).

### Sécurité
- Vérification stricte des rôles et permissions.  
- Accès restreint aux commandes sensibles (adminOnly).  
- Gestion d’erreurs, réponses différées et anti-spam intégrés.

---

## 4. Technologies et architecture / Technical Stack

- **Node.js** 20+  
- **Discord.js v14**  
- **TMI.js** (chat Twitch)  
- **Axios** (requêtes HTTP Helix)  
- **dotenv** (variables d’environnement)  

### Architecture générale :
