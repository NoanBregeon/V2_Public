
const axios = require('axios');

function helixHeaders() {
  return {
    'Client-ID': process.env.TWITCH_CLIENT_ID,
    'Authorization': `Bearer ${process.env.TWITCH_USER_TOKEN}`
  };
}

async function getUserByLogin(login) {
  const r = await axios.get('https://api.twitch.tv/helix/users', { headers: helixHeaders(), params: { login } });
  return r.data?.data?.[0] || null;
}

async function resolveBroadcasterId() {
  const login = process.env.STREAMER_USERNAME;
  if (!login) throw new Error('STREAMER_USERNAME manquant');
  const user = await getUserByLogin(login);
  if (!user) throw new Error('Broadcaster introuvable');
  return user.id;
}

module.exports = { helixHeaders, getUserByLogin, resolveBroadcasterId };
