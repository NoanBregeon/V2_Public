# Discord + Twitch Bot V2 (unified .env)
Commandes:
- Rôles Discord: /addmodo /removemodo /addvip /removevip /listmods /listvips
- Modération: /mute /unmute /kick /discordban /unban /warn /userinfo /listbans
- Twitch: /twitchaddmod /twitchremovemod /twitchban /twitchtimeout /twitchunban /twitchsearch
- Voix: /rename /limit /lock /unlock /transfer
- Welcome: /welcome toggle|add|remove|test
- Tickets: /ticketpanel
- Admin: /admin reload

Install:
  cp .env.example .env  # remplir
  npm install
  npm run dev

Twitch scopes requis:
- channel:manage:moderators
- channel:manage:vips
- moderator:manage:banned_users
