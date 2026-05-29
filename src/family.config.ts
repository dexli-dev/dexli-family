// Canonical registry of every dexli.dev sibling shipped to production as of
// cycle 2. The single source of truth for sender slug allocation + recipient
// param naming.
//
// Bar item 2: the three live siblings are webhook, cron, regex.
//
// Adding a new sibling = a new entry here + a new round-trip test. See
// DISCIPLINE.md for the procedure and the slug-stability promise.

export type FamilySlug = 'webhook' | 'cron' | 'regex' | 'diff';

/**
 * Display content for the apex hub's tools-index card. `null` when the
 * sibling is registered but not yet ready to surface in the apex card grid
 * (e.g. mid-cycle pre-ship per the §1.1 cycle-N carve-out). Distinct from
 * `published` — `apexCard` is "what should the card show," `published` is
 * "should the card show at all."
 */
export interface FamilyApexCard {
	/** Single-glyph badge shown in the apex card's lime tile. MUST be
	 * distinct from every other sibling's glyph AND from the family-level
	 * apex glyph (`❖`). Verifiable per D2 bar item 10 / D4 bar item 10. */
	readonly glyph: string;
	/** Display name in the apex card. Typically lowercase sibling slug. */
	readonly title: string;
	/** One-line purpose copy in the apex card. ≤140 chars practical limit. */
	readonly tagline: string;
}

/**
 * Display / publication state for a sibling. Two flags express today's
 * scaffold-vs-ship gap (distinct concerns) per CEO lock 2026-05-29:
 *
 *   - `apexCard`: display content if/when the card shows. `null` means
 *     "card content not yet authored" (mid-cycle registration etc).
 *   - `published`: gate on whether downstream consumers (apex hub) include
 *     this sibling in their auto-render filter. `false` means "registered
 *     but not yet live; don't surface."
 *
 * The apex hub's auto-render filter is `published === true && apexCard !== null`.
 * Both flags pre-ship state is `apexCard: null, published: false`; ship
 * moment is a single boolean flip `published: false → true` accompanied by
 * the apex-card content population (one between-cycle scaffold commit in
 * dexli-family lockstep with the sibling's first M-deploy).
 *
 * Future ventures inherit the auto-render shape without per-venture apex-page
 * edit — just a dexli-family entry update.
 */
export interface FamilyDisplay {
	readonly apexCard: FamilyApexCard | null;
	readonly published: boolean;
}

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
	/** Display + publication state (CEO lock 2026-05-29). */
	readonly display: Readonly<FamilyDisplay>;
}

export const FAMILY: Readonly<Record<FamilySlug, FamilySibling>> = Object.freeze({
	webhook: Object.freeze({
		slug: 'webhook',
		baseUrl: 'https://webhook.dexli.dev',
		path: '/',
		inputs: Object.freeze({}),
		display: Object.freeze({
			apexCard: Object.freeze({
				glyph: '⌁',
				title: 'webhook',
				tagline: 'Temporary webhook inbox — capture, inspect, replay HTTP callbacks.'
			}),
			published: true
		})
	}),
	cron: Object.freeze({
		slug: 'cron',
		baseUrl: 'https://cron.dexli.dev',
		path: '/',
		inputs: Object.freeze({
			expression: 'e',
			tz: 'tz'
		}),
		display: Object.freeze({
			apexCard: Object.freeze({
				glyph: '◷',
				title: 'cron',
				tagline: 'Cron expression parser — firings, timezones, shareable URL state.'
			}),
			published: true
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
		}),
		display: Object.freeze({
			apexCard: Object.freeze({
				glyph: '∋',
				title: 'regex',
				tagline: 'Live regex tester — highlight, enumerate, share via URL.'
			}),
			published: true
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
		}),
		// Live as of 2026-05-29 — M deployed diff.dexli.dev after
		// D4/submit-1 APPROVE. Step 5 of CEO's apex-TOOLS auto-render
		// sequence: both flags flip in one commit at ship moment.
		// `apexCard` populated with { glyph: 'Δ' (Wordmark default,
		// distinct from ⌁/◷/∋/❖), title, tagline matching the parallel
		// shape of webhook/cron/regex entries }. `published: true`
		// turns the apex auto-render filter from selecting 3 siblings
		// to selecting 4 siblings; dexli-hub picks this up via its
		// next submodule pin bump (lockstep with this commit per
		// CONTRIBUTING.md submodule discipline).
		display: Object.freeze({
			apexCard: Object.freeze({
				glyph: 'Δ',
				title: 'diff',
				tagline: 'Two-pane text diff — paste, see what changed, share via URL.'
			}),
			published: true
		})
	})
} as const);

/** Type-guard: narrows an arbitrary string to a registered FamilySlug. */
export function isFamilySlug(s: string): s is FamilySlug {
	return Object.prototype.hasOwnProperty.call(FAMILY, s);
}
