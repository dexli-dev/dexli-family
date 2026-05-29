// Canonical registry of every dexli.dev sibling shipped to production as of
// cycle 2. The single source of truth for sender slug allocation + recipient
// param naming.
//
// Bar item 2: the three live siblings are webhook, cron, regex.
//
// Adding a new sibling = a new entry here + a new round-trip test. See
// DISCIPLINE.md for the procedure and the slug-stability promise.

export type FamilySlug = 'webhook' | 'cron' | 'regex' | 'diff';

export interface FamilySibling {
	/** Stable, public slug identifying the sibling. Once registered for a
	 * shipped sibling, the slug is part of the family's API forever. */
	readonly slug: FamilySlug;
	/** Canonical origin (scheme + host + optional port). No trailing slash. */
	readonly baseUrl: string;
	/** URL path component the handoff URL targets. V1 ships flat
	 * "/"-rooted siblings only; path-tokenized recipients are a
	 * future-cycle concern. */
	readonly path: string;
	/** Logical field name → URL param name. MUST EXACTLY mirror the
	 * recipient's `readUrlState()` accepted param keys. Empty map
	 * indicates the sibling has no URL-state inputs (e.g. webhook,
	 * whose state lives in the path, not the query string). */
	readonly inputs: Readonly<Record<string, string>>;
}

export const FAMILY: Readonly<Record<FamilySlug, FamilySibling>> = Object.freeze({
	webhook: Object.freeze({
		slug: 'webhook',
		baseUrl: 'https://webhook.dexli.dev',
		path: '/',
		inputs: Object.freeze({})
	}),
	cron: Object.freeze({
		slug: 'cron',
		baseUrl: 'https://cron.dexli.dev',
		path: '/',
		inputs: Object.freeze({
			expression: 'e',
			tz: 'tz'
		})
	}),
	regex: Object.freeze({
		slug: 'regex',
		baseUrl: 'https://regex.dexli.dev',
		path: '/',
		inputs: Object.freeze({
			pattern: 'p',
			text: 't',
			flags: 'f'
		})
	}),
	diff: Object.freeze({
		slug: 'diff',
		baseUrl: 'https://diff.dexli.dev',
		path: '/',
		inputs: Object.freeze({
			// Flat 1:1 mapping per diff's `src/lib/url-state.ts` contract —
			// logical and URL-param names coincide. Bar D4 product call 5
			// names a/b/mode as both the URL-share-scope AND the canonical
			// state names; flat mapping is bar-faithful.
			a: 'a',
			b: 'b',
			mode: 'mode'
		})
	})
} as const);

/** Type-guard: narrows an arbitrary string to a registered FamilySlug. */
export function isFamilySlug(s: string): s is FamilySlug {
	return Object.prototype.hasOwnProperty.call(FAMILY, s);
}
