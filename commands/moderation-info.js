const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
module.exports = [
  { data:new SlashCommandBuilder().setName('userinfo').setDescription('Infos sur un utilisateur').addUserOption(o=>o.setName('utilisateur').setDescription('Membre').setRequired(false)).setDMPermission(false),
    async execute(i){ const user=i.options.getUser('utilisateur')||i.user; const member=await i.guild.members.fetch(user.id).catch(()=>null); const embed=new EmbedBuilder().setTitle(`👤 ${user.tag}`).addFields({name:'ID', value:user.id, inline:true},{name:'Créé', value:`<t:${Math.floor(user.createdTimestamp/1000)}:R>`, inline:true}, member?{name:'Rejoint', value:`<t:${Math.floor(member.joinedTimestamp/1000)}:R>`, inline:true}:{name:'Serveur', value:'?', inline:true}).setThumbnail(user.displayAvatarURL({ size:256 })).setColor(0x3498DB); await i.reply({ embeds:[embed], flags:64 }); } },
  { data:new SlashCommandBuilder().setName('listbans').setDescription('Lister les utilisateurs bannis').setDMPermission(false),
    async execute(i){ const bans=await i.guild.bans.fetch().catch(()=>null); if(!bans) return i.reply({ content:'❌ Impossible de lire les bannis.', flags:64 }); const list=bans.map(b=>`${b.user.tag} (${b.user.id})`).join('\n')||'Aucun.'; await i.reply({ content:list.length>1900?list.slice(0,1900):list, flags:64 }); } }
];
