const axios = require('axios');

let broadcasterCache = { id: null, username: null };

function helixHeaders() {
  return {
    'Client-Id': process.env.TWITCH_CLIENT_ID,
    'Authorization': `Bearer ${process.env.TWITCH_USER_TOKEN}`
  };
}

async function resolveBroadcasterId() {
  const username = process.env.STREAMER_USERNAME;
  if (!username) throw new Error('STREAMER_USERNAME manquant');
  if (broadcasterCache.id && broadcasterCache.username === username) return broadcasterCache.id;

  const r = await axios.get('https://api.twitch.tv/helix/users', {
    headers: helixHeaders(),
    params: { login: username }
  });
  const u = r.data?.data?.[0];
  if (!u) throw new Error('Broadcaster introuvable');
  broadcasterCache = { id: u.id, username };
  return u.id;
}

async function getUserByLogin(login) {
  const r = await axios.get('https://api.twitch.tv/helix/users', {
    headers: helixHeaders(),
    params: { login }
  });
  return r.data?.data?.[0] || null;
}

module.exports = { helixHeaders, resolveBroadcasterId, getUserByLogin };