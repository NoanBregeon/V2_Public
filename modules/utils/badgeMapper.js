module.exports = {
	// tags : l'objet tags fourni par tmi.js
	getBadges(tags) {
		if (!tags) return '';

		// Lecture des overrides éventuels depuis l'environnement (optionnel)
		const MAP = {
			moderator: process.env.BADGE_MOD || '🛡️',
			vip: process.env.BADGE_VIP || '💎',
			subscriber: process.env.BADGE_SUB || '⭐',
			broadcaster: process.env.BADGE_BROADCASTER || '🎙️',
			partner: process.env.BADGE_PARTNER || '🤝',
			verified: process.env.BADGE_VERIFIED || '✅',
			prime: process.env.BADGE_PRIME || '🎁',
			founder: process.env.BADGE_FOUNDER || '👑',
			// ajoute d'autres mappings si nécessaire
		};

		// 1) Priorité : tags.badges (objet) si présent (ex: { subscriber: '12', moderator: '1' })
		let badges = [];
		const tb = tags.badges || tags['badge-info'] || tags.badge || null;
		if (tb && typeof tb === 'object') {
			for (const key of Object.keys(tb)) {
				const k = String(key).toLowerCase();
				if (MAP[k]) badges.push(MAP[k]);
			}
		}

		// 2) Fallbacks via flags / booleans généralement fournis par tmi.js
		try {
			if (tags.mod || tags['mod']) {
				if (!badges.includes(MAP.moderator)) badges.push(MAP.moderator);
			}
			if (tags.vip || tags['vip']) {
				if (!badges.includes(MAP.vip)) badges.push(MAP.vip);
			}
			// subscriber peut être boolean ou number (months)
			if (tags.subscriber || tags['subscriber']) {
				if (!badges.includes(MAP.subscriber)) badges.push(MAP.subscriber);
			}
			// broadcaster check via badges or badges['broadcaster']
			if ((tb && tb.broadcaster) || tags.badges?.broadcaster) {
				if (!badges.includes(MAP.broadcaster)) badges.push(MAP.broadcaster);
			}
		} catch (e) { /* silent */ }

		// 3) Dédupliquer et retourner
		badges = [...new Set(badges)];
		// Retour sous forme de string terminée par un espace si non vide
		return badges.length ? (badges.join(' ') + ' ') : '';
	}
};
