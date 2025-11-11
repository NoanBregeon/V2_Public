const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs'); const path = require('path'); const file = path.join(__dirname,'../data/welcome.json');
module.exports = { data:new SlashCommandBuilder().setName('welcome').setDescription('Système de bienvenue')
  .addSubcommand(s=>s.setName('toggle').setDescription('Activer/désactiver').addBooleanOption(o=>o.setName('enabled').setDescription('true/false').setRequired(true)))
  .addSubcommand(s=>s.setName('add').setDescription('Ajouter un message').addStringOption(o=>o.setName('type').setDescription('type').setRequired(true)).addStringOption(o=>o.setName('message').setDescription('Message avec {user}').setRequired(true)))
  .addSubcommand(s=>s.setName('remove').setDescription('Supprimer un message').addStringOption(o=>o.setName('type').setDescription('type').setRequired(true)))
  .addSubcommand(s=>s.setName('test').setDescription('Tester le message')),
  async execute(i){ const data=JSON.parse(fs.readFileSync(file,'utf8')); const sub=i.options.getSubcommand();
    if (sub==='toggle'){ data.enabled=i.options.getBoolean('enabled'); fs.writeFileSync(file, JSON.stringify(data,null,2)); return i.reply({ content:`✅ Welcome ${data.enabled?'activé':'désactivé'}.`, flags:64 }); }
    if (sub==='add'){ const t=i.options.getString('type'), msg=i.options.getString('message'); data.messages=data.messages||{}; data.messages[t]=msg; fs.writeFileSync(file, JSON.stringify(data,null,2)); return i.reply({ content:`✅ Message "${t}" enregistré.`, flags:64 }); }
    if (sub==='remove'){ const t=i.options.getString('type'); if(data.messages) delete data.messages[t]; fs.writeFileSync(file, JSON.stringify(data,null,2)); return i.reply({ content:`✅ Message "${t}" supprimé.`, flags:64 }); }
    if (sub==='test'){ const chanId=process.env.WELCOME_CHANNEL_ID; if(!chanId) return i.reply({ content:'⚠️ WELCOME_CHANNEL_ID manquant.', flags:64 }); const ch=i.guild.channels.cache.get(chanId) || await i.guild.channels.fetch(chanId).catch(()=>null); if(!ch) return i.reply({ content:'⚠️ Salon introuvable.', flags:64 }); const tpl=(data.messages&&data.messages['default'])||'Bienvenue {user}!'; await ch.send(tpl.replace('{user}', `<@${i.user.id}>`)); return i.reply({ content:'✅ Message de test envoyé.', flags:64 }); }
  } };
