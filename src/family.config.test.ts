import { describe, expect, it } from 'vitest';
import { FAMILY, isFamilySlug } from './family.config';

describe('FAMILY canonical registry (bar item 2 + D4 carve-out)', () => {
	it('registers the v1 siblings + D4-registered diff: webhook, cron, regex, diff', () => {
		expect(Object.keys(FAMILY).sort()).toEqual(['cron', 'diff', 'regex', 'webhook']);
	});

	it('webhook registers with empty input map (path-based identity)', () => {
		expect(FAMILY.webhook.slug).toBe('webhook');
		expect(FAMILY.webhook.baseUrl).toBe('https://webhook.dexli.dev');
		expect(FAMILY.webhook.path).toBe('/');
		expect(FAMILY.webhook.inputs).toEqual({});
	});

	it('cron registers with expression + tz inputs mapped to ?e= and ?tz=', () => {
		expect(FAMILY.cron.slug).toBe('cron');
		expect(FAMILY.cron.baseUrl).toBe('https://cron.dexli.dev');
		expect(FAMILY.cron.path).toBe('/');
		expect(FAMILY.cron.inputs).toEqual({ expression: 'e', tz: 'tz' });
	});

	it('regex registers with pattern + text + flags inputs mapped to ?p=, ?t=, ?f=', () => {
		expect(FAMILY.regex.slug).toBe('regex');
		expect(FAMILY.regex.baseUrl).toBe('https://regex.dexli.dev');
		expect(FAMILY.regex.path).toBe('/');
		expect(FAMILY.regex.inputs).toEqual({ pattern: 'p', text: 't', flags: 'f' });
	});

	it('diff registers with a + b + mode inputs mapped to ?a=, ?b=, ?mode= (D4 mid-cycle per §1.1 carve-out)', () => {
		expect(FAMILY.diff.slug).toBe('diff');
		expect(FAMILY.diff.baseUrl).toBe('https://diff.dexli.dev');
		expect(FAMILY.diff.path).toBe('/');
		expect(FAMILY.diff.inputs).toEqual({ a: 'a', b: 'b', mode: 'mode' });
	});

	describe('display block (CEO two-flag lock 2026-05-29)', () => {
		it('webhook is published with apexCard content', () => {
			expect(FAMILY.webhook.display.published).toBe(true);
			expect(FAMILY.webhook.display.apexCard).toEqual({
				glyph: '⌁',
				title: 'webhook',
				tagline: 'Temporary webhook inbox — capture, inspect, replay HTTP callbacks.'
			});
		});

		it('cron is published with apexCard content', () => {
			expect(FAMILY.cron.display.published).toBe(true);
			expect(FAMILY.cron.display.apexCard).toEqual({
				glyph: '◷',
				title: 'cron',
				tagline: 'Cron expression parser — firings, timezones, shareable URL state.'
			});
		});

		it('regex is published with apexCard content', () => {
			expect(FAMILY.regex.display.published).toBe(true);
			expect(FAMILY.regex.display.apexCard).toEqual({
				glyph: '∋',
				title: 'regex',
				tagline: 'Live regex tester — highlight, enumerate, share via URL.'
			});
		});

		it('diff is published with apexCard content (post-D4-ship Step 5 flip 2026-05-29)', () => {
			expect(FAMILY.diff.display.published).toBe(true);
			expect(FAMILY.diff.display.apexCard).toEqual({
				glyph: 'Δ',
				title: 'diff',
				tagline: 'Two-pane text diff — paste, see what changed, share via URL.'
			});
		});

		it('every published sibling has non-null apexCard (no published-without-content state)', () => {
			for (const sib of Object.values(FAMILY)) {
				if (sib.display.published) {
					expect(sib.display.apexCard).not.toBeNull();
				}
			}
		});

		it('every apexCard has all three required fields (glyph, title, tagline)', () => {
			for (const sib of Object.values(FAMILY)) {
				if (sib.display.apexCard !== null) {
					expect(typeof sib.display.apexCard.glyph).toBe('string');
					expect(typeof sib.display.apexCard.title).toBe('string');
					expect(typeof sib.display.apexCard.tagline).toBe('string');
					expect(sib.display.apexCard.glyph.length).toBeGreaterThan(0);
					expect(sib.display.apexCard.title.length).toBeGreaterThan(0);
					expect(sib.display.apexCard.tagline.length).toBeGreaterThan(0);
				}
			}
		});

		it('apex auto-render filter (published === true && apexCard !== null) selects all 4 siblings post-D4-ship', () => {
			const visible = Object.values(FAMILY).filter(
				(s) => s.display.published === true && s.display.apexCard !== null
			);
			expect(visible.map((s) => s.slug).sort()).toEqual(['cron', 'diff', 'regex', 'webhook']);
		});

		it('every apexCard glyph is distinct across siblings (D2/D4 bar item 10 enforcement)', () => {
			const glyphs = Object.values(FAMILY)
				.map((s) => s.display.apexCard?.glyph)
				.filter((g): g is string => g != null);
			expect(new Set(glyphs).size).toBe(glyphs.length);
		});
	});

	it('every baseUrl is HTTPS with no trailing slash', () => {
		for (const sib of Object.values(FAMILY)) {
			expect(sib.baseUrl.startsWith('https://')).toBe(true);
			expect(sib.baseUrl.endsWith('/')).toBe(false);
		}
	});

	it('FAMILY is deeply frozen — no runtime mutation of the registry', () => {
		expect(Object.isFrozen(FAMILY)).toBe(true);
		for (const sib of Object.values(FAMILY)) {
			expect(Object.isFrozen(sib)).toBe(true);
			expect(Object.isFrozen(sib.inputs)).toBe(true);
			expect(Object.isFrozen(sib.display)).toBe(true);
			if (sib.display.apexCard !== null) {
				expect(Object.isFrozen(sib.display.apexCard)).toBe(true);
			}
		}
	});
});

describe('isFamilySlug type guard', () => {
	it('returns true for each registered slug', () => {
		expect(isFamilySlug('webhook')).toBe(true);
		expect(isFamilySlug('cron')).toBe(true);
		expect(isFamilySlug('regex')).toBe(true);
		expect(isFamilySlug('diff')).toBe(true);
	});

	it('returns false for unknown strings', () => {
		expect(isFamilySlug('unknown')).toBe(false);
		expect(isFamilySlug('')).toBe(false);
		expect(isFamilySlug('WEBHOOK')).toBe(false); // case-sensitive
	});

	it('does not match prototype properties (no prototype pollution)', () => {
		expect(isFamilySlug('toString')).toBe(false);
		expect(isFamilySlug('hasOwnProperty')).toBe(false);
		expect(isFamilySlug('__proto__')).toBe(false);
	});
});
