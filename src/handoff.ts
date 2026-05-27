// URL handoff builder. The single function call (bar item 1) that composes
// a handoff URL targeting any registered sibling, returning either a ready-
// to-use URL or a clear, caller-detectable failure signal (bar items 3, 6, 7).
//
// All four §11.5 sender preconditions are enforced inside this function so a
// caller that uses the builder cannot violate them:
//   - parser-is-the-contract: inputs map keys are dictated by family.config
//   - encode-through-the-URL-primitives: every value passes through
//     URLSearchParams.set() before joining
//   - length-check-on-the-FINAL-encoded-URL: bytes measured AFTER encoding
//   - non-text-value-rejected: non-string values cannot be encoded as a
//     UTF-8 string and return non-text-value rather than attempt coercion

import { FAMILY, isFamilySlug, type FamilySibling } from './family.config';

/**
 * Maximum total URL length the builder will produce, measured as the byte
 * length of the FINAL encoded URL (`origin + path + '?' + queryString`).
 * Bar item 6.
 */
export const MAX_HANDOFF_URL_BYTES = 4096;

/**
 * Discriminated-union return value. The builder always returns a value;
 * it never throws on input-shape errors. Callers branch on `.ok`.
 */
export type HandoffResult =
	| { ok: true; url: string }
	| { ok: false; kind: 'unknown-recipient'; slug: string }
	| { ok: false; kind: 'unknown-field'; recipient: string; field: string }
	| { ok: false; kind: 'over-cap'; length: number; cap: number }
	| { ok: false; kind: 'non-text-value'; field: string };

export interface BuildHandoffOpts {
	/** Recipient slug. MUST be a registered FamilySlug in `FAMILY`. */
	to: string;
	/** Logical field name → input value. Values MUST be strings. Field
	 * names MUST be keys of the recipient's `inputs` map. */
	inputs?: Readonly<Record<string, unknown>>;
}

export function buildHandoffUrl(opts: BuildHandoffOpts): HandoffResult {
	if (!isFamilySlug(opts.to)) {
		return { ok: false, kind: 'unknown-recipient', slug: opts.to };
	}

	const sibling: FamilySibling = FAMILY[opts.to];
	const params = new URLSearchParams();

	for (const [field, value] of Object.entries(opts.inputs ?? {})) {
		const paramName = sibling.inputs[field];
		if (paramName === undefined) {
			return {
				ok: false,
				kind: 'unknown-field',
				recipient: sibling.slug,
				field
			};
		}
		if (typeof value !== 'string') {
			return { ok: false, kind: 'non-text-value', field };
		}
		params.set(paramName, value);
	}

	const queryString = params.toString();
	const url = queryString
		? `${sibling.baseUrl}${sibling.path}?${queryString}`
		: `${sibling.baseUrl}${sibling.path}`;

	const length = byteLength(url);
	if (length > MAX_HANDOFF_URL_BYTES) {
		return {
			ok: false,
			kind: 'over-cap',
			length,
			cap: MAX_HANDOFF_URL_BYTES
		};
	}

	return { ok: true, url };
}

/**
 * Byte length of a string when serialized as UTF-8. URL strings after
 * percent-encoding are pure ASCII so `s.length === byte length`, but we
 * use TextEncoder for explicit byte semantics — the bar's cap is stated
 * in bytes and this resists future drift if any non-ASCII slips into a
 * registered baseUrl.
 */
function byteLength(s: string): number {
	return new TextEncoder().encode(s).length;
}
