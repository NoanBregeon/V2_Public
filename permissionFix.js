/**
 * Utilitaire pour référencer les permissions Discord.js v14
 * 
 * Ce fichier sert de référence pour les permissions Discord.js v14
 * qui sont légèrement différentes des versions précédentes.
 */

const { PermissionFlagsBits } = require('discord.js');

// Liste complète des permissions disponibles dans Discord.js v14
const validPermissions = {
    // Permissions générales
    'ViewChannel': PermissionFlagsBits.ViewChannel,
    'ManageChannels': PermissionFlagsBits.ManageChannels,
    'ManageRoles': PermissionFlagsBits.ManageRoles,
    'CreateInstantInvite': PermissionFlagsBits.CreateInstantInvite,
    'ManageGuild': PermissionFlagsBits.ManageGuild,
    
    // Permissions de texte
    'SendMessages': PermissionFlagsBits.SendMessages,
    'SendMessagesInThreads': PermissionFlagsBits.SendMessagesInThreads,
    'CreatePublicThreads': PermissionFlagsBits.CreatePublicThreads,
    'CreatePrivateThreads': PermissionFlagsBits.CreatePrivateThreads,
    'EmbedLinks': PermissionFlagsBits.EmbedLinks,
    'AttachFiles': PermissionFlagsBits.AttachFiles,
    'AddReactions': PermissionFlagsBits.AddReactions,
    'UseExternalEmojis': PermissionFlagsBits.UseExternalEmojis,
    'UseExternalStickers': PermissionFlagsBits.UseExternalStickers,
    'MentionEveryone': PermissionFlagsBits.MentionEveryone,
    'ManageMessages': PermissionFlagsBits.ManageMessages,
    'ManageThreads': PermissionFlagsBits.ManageThreads,
    'ReadMessageHistory': PermissionFlagsBits.ReadMessageHistory,
    
    // Permissions vocales
    'Connect': PermissionFlagsBits.Connect,
    'Speak': PermissionFlagsBits.Speak,
    'Stream': PermissionFlagsBits.Stream,
    'UseEmbeddedActivities': PermissionFlagsBits.UseEmbeddedActivities, // À utiliser au lieu de UseVoiceActivation
    'PrioritySpeaker': PermissionFlagsBits.PrioritySpeaker,
    'MuteMembers': PermissionFlagsBits.MuteMembers,
    'DeafenMembers': PermissionFlagsBits.DeafenMembers,
    'MoveMembers': PermissionFlagsBits.MoveMembers,
    
    // Permissions administratives
    'Administrator': PermissionFlagsBits.Administrator,
    'BanMembers': PermissionFlagsBits.BanMembers,
    'KickMembers': PermissionFlagsBits.KickMembers,
    'ModerateMembers': PermissionFlagsBits.ModerateMembers
};

/**
 * Convertit des noms de permissions en chaînes de caractères vers leurs valeurs numériques
 * @param {Array<string>} permissionNames - Tableau de noms de permissions
 * @returns {Array<BigInt>} - Tableau de valeurs BigInt des permissions
 */
function convertPermissions(permissionNames) {
    return permissionNames.map(name => {
        if (!validPermissions[name]) {
            console.warn(`⚠️ Permission invalide: "${name}"`);
            return null;
        }
        return validPermissions[name];
    }).filter(p => p !== null);
}

// Exemple d'utilisation des permissions pour les salons vocaux
const voiceChannelExample = {
    // Permissions courantes pour les salons vocaux
    everyone: {
        allow: convertPermissions(['Connect', 'Speak', 'Stream']),
        deny: convertPermissions(['MoveMembers'])
    },
    owner: {
        allow: convertPermissions(['Connect', 'Speak', 'Stream', 'MuteMembers', 'DeafenMembers', 'ManageChannels'])
    }
};

module.exports = {
    validPermissions,
    convertPermissions,
    voiceChannelExample
};

console.log('📝 Référence des permissions Discord.js v14 chargée');
console.log('💡 Exemple: Utilisez "Stream" au lieu de "Stream", "UseEmbeddedActivities" au lieu de "UseVoiceActivation"');
