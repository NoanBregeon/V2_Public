const notificationConfig = require('./notificationConfig');

/**
 * Helper global pour neutraliser les pings quand le live-ping est OFF.
 * - canPing() : vrai seulement si le système permet de pinger (et pas hardKill)
 * - sanitize() : retire les mentions potentielles du contenu
 * - send(channel, payload) : envoie de façon sécurisée (payload = string | object)
 */

function hardKill() {
	// FORCE_DISABLE_PINGS override global (1 / true)
	const v = (process.env.FORCE_DISABLE_PINGS || '').toString().toLowerCase();
	return v === 'true' || v === '1';
}

function canPing() {
	// reload pour être sûr d'avoir la config la plus récente
	try { notificationConfig.reload?.(); } catch {}
	if (hardKill()) return false;
	if (!notificationConfig.isLivePingEnabled()) return false;
	// au moins un élément (role/message) requis pour pinger
	const role = notificationConfig.getPingRoleId();
	const msg = notificationConfig.getPingMessage();
	return Boolean(role || msg);
}

function sanitizeString(str) {
	if (!str || typeof str !== 'string') return str ? String(str) : '';
	// Retirer mentions <@&id>, <@!id>, @everyone, @here
	return str
		.replace(/@everyone/gi, 'everyone')
		.replace(/@here/gi, 'here')
		.replace(/<@&\d+>/g, '')
		.replace(/<@!?\d+>/g, '')
		.trim();
}

function sanitizeEmbed(embed) {
	try {
		// Support EmbedBuilder (has toJSON) et plain object
		let obj = embed;
		if (embed && typeof embed.toJSON === 'function') {
			// Convert EmbedBuilder -> plain object
			try { obj = embed.toJSON(); } catch (e) { obj = embed; }
		}
		if (!obj || typeof obj !== 'object') return obj;

		// Sanitize common fields safely
		if (obj.description) obj.description = sanitizeString(String(obj.description));
		if (obj.title) obj.title = sanitizeString(String(obj.title));
		if (obj.footer && obj.footer.text) obj.footer.text = sanitizeString(String(obj.footer.text));
		if (obj.author && obj.author.name) obj.author.name = sanitizeString(String(obj.author.name));

		if (Array.isArray(obj.fields)) {
			obj.fields = obj.fields.map(f => ({
				name: sanitizeString(String((f && f.name) || '')),
				value: sanitizeString(String((f && f.value) || '')),
				inline: Boolean(f && f.inline)
			})).filter(f => (f.name || f.value)); // garder uniquement champs utiles
		}
		return obj;
	} catch (e) {
		// En cas d'erreur, renvoyer l'embed original pour ne pas bloquer l'envoi
		return embed;
	}
}

/**
 * Envoie sécurisé : si canPing() false, nettoie contenu + embeds.
 * payload peut être :
 *  - string
 *  - { content, embeds, files, components, ... }
 */
async function send(channel, payload) {
	// fallback pour éviter crash
	if (!channel || typeof channel.send !== 'function') return null;

	// si autorisé -> envoi direct
	if (canPing()) {
		try { return await channel.send(payload); } catch (e) { throw e; }
	}

	// sinon: sanitize
	try {
		if (typeof payload === 'string') {
			const safe = sanitizeString(payload);
			if (!safe) return null;
			return await channel.send(safe);
		}
		if (typeof payload === 'object' && payload !== null) {
			const out = { ...payload };
			if (out.content) out.content = sanitizeString(String(out.content));
			if (out.embeds) {
				// map embeds de façon sûre (gère EmbedBuilder et objets)
				out.embeds = out.embeds
					.map(e => sanitizeEmbed(e))
					.filter(e => {
						// garder uniquement embeds ayant du contenu utile
						if (!e) return false;
						const hasDesc = e.description && String(e.description).trim();
						const hasTitle = e.title && String(e.title).trim();
						const hasFields = Array.isArray(e.fields) && e.fields.length > 0;
						return Boolean(hasDesc || hasTitle || hasFields);
					});
			}
			// si contenu vide et pas d'embed valide -> ne rien envoyer
			const hasContent = out.content && String(out.content).trim();
			const hasEmbeds = Array.isArray(out.embeds) && out.embeds.length > 0;
			if (!hasContent && !hasEmbeds) return null;
			return await channel.send(out);
		}
		// Unknown payload -> attempt best-effort
		const s = String(payload || '');
		const safe = sanitizeString(s);
		if (!safe) return null;
		return await channel.send(safe);
	} catch (e) {
		throw e;
	}
}

module.exports = {
  canPing,
  sanitize: sanitizeString, // <-- renomme la clé
  send,
  hardKill,
};

