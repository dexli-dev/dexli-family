import { describe, expect, it } from 'vitest';
import { FAMILY, isFamilySlug } from './family.config';

describe('FAMILY canonical registry (bar item 2)', () => {
	it('registers exactly the three v1 siblings: webhook, cron, regex', () => {
		expect(Object.keys(FAMILY).sort()).toEqual(['cron', 'regex', 'webhook']);
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
		}
	});
});

describe('isFamilySlug type guard', () => {
	it('returns true for each registered slug', () => {
		expect(isFamilySlug('webhook')).toBe(true);
		expect(isFamilySlug('cron')).toBe(true);
		expect(isFamilySlug('regex')).toBe(true);
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
