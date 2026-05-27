// @vitest-environment jsdom
//
// Round-trip tests against the REAL recipient URL-state parsers (bar items
// 4 + 5). Each sibling's `readUrlState()` is imported by reference from the
// sibling's actual source — not mocked, stubbed, or hand-rolled.
//
// The sibling parsers read `window.location.search` via URLSearchParams.
// jsdom provides that window; `history.pushState` mutates location.search
// without a page load — the canonical primitive for this kind of test.
//
// Per-file environment directive (above) keeps non-round-trip tests in the
// fast node environment.

import { beforeEach, describe, expect, it } from 'vitest';
import { buildHandoffUrl } from './handoff';
import { readUrlState as readCronState } from '../vendored/cron-dexli/src/lib/url-state';
import { readUrlState as readRegexState } from '../vendored/regex-dexli/src/lib/url-state';

function navigateTo(url: string): void {
	const u = new URL(url);
	window.history.pushState({}, '', u.pathname + u.search);
}

beforeEach(() => {
	window.history.replaceState({}, '', '/');
});

describe('round-trip via real cron parser (bar item 4)', () => {
	it('expression + tz survives builder → readCronState', () => {
		const r = buildHandoffUrl({
			to: 'cron',
			inputs: { expression: '0 9 * * 1-5', tz: 'Europe/Oslo' }
		});
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		navigateTo(r.url);
		const state = readCronState();
		expect(state.expression).toBe('0 9 * * 1-5');
		expect(state.tz).toBe('Europe/Oslo');
	});

	it('expression alone (no tz) recovers expression without tz', () => {
		const r = buildHandoffUrl({
			to: 'cron',
			inputs: { expression: '*/5 * * * *' }
		});
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		navigateTo(r.url);
		const state = readCronState();
		expect(state.expression).toBe('*/5 * * * *');
		expect(state.tz).toBeUndefined();
	});
});

describe('round-trip via real regex parser (bar item 4)', () => {
	it('pattern + text + flags survives builder → readRegexState', () => {
		const r = buildHandoffUrl({
			to: 'regex',
			inputs: { pattern: '\\d+', text: 'order 42', flags: 'gi' }
		});
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		navigateTo(r.url);
		const state = readRegexState();
		expect(state.pattern).toBe('\\d+');
		expect(state.testText).toBe('order 42');
		expect(state.flags).toEqual({
			global: true,
			caseInsensitive: true,
			multiline: false,
			dotAll: false
		});
	});

	it('pattern + text without flags recovers cleanly', () => {
		const r = buildHandoffUrl({
			to: 'regex',
			inputs: { pattern: 'hello', text: 'hello world' }
		});
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		navigateTo(r.url);
		const state = readRegexState();
		expect(state.pattern).toBe('hello');
		expect(state.testText).toBe('hello world');
		expect(state.flags).toBeUndefined();
	});
});

describe('special-character round-trip — every class in bar item 5', () => {
	// Bar item 5: "newlines, percent signs, ampersands, plus signs, equals
	// signs, square brackets, parens, slashes, backslashes, hashes, question
	// marks, spaces, and non-ASCII Unicode (including emoji)."
	const CASES: Array<[string, string]> = [
		['newlines', 'line one\nline two\nline three'],
		['percent signs', 'value with % sign and more %%'],
		['ampersands', 'a & b & c'],
		['plus signs', '1+1 = 2 + 3'],
		['equals signs', 'key=value=other'],
		['square brackets', '[abc][def]'],
		['parens', '(group)(another)'],
		['forward slashes', 'path/to/thing/here'],
		['backslashes', 'C:\\Windows\\System32'],
		['hashes', '#anchor #tag'],
		['question marks', 'who? what? why?'],
		['spaces', 'hello world with spaces'],
		['non-ASCII Unicode', 'café — naïve — bønn'],
		['emoji', '🦊 jumps over 🐶 — 👋']
	];

	describe('via regex testText (param ?t=)', () => {
		for (const [label, value] of CASES) {
			it(`${label}: round-trip preserves bytes`, () => {
				const r = buildHandoffUrl({ to: 'regex', inputs: { text: value } });
				expect(r.ok, `builder failed: ${label}`).toBe(true);
				if (!r.ok) return;
				navigateTo(r.url);
				expect(readRegexState().testText).toBe(value);
			});
		}
	});

	describe('via regex pattern (param ?p=)', () => {
		for (const [label, value] of CASES) {
			it(`${label}: round-trip preserves bytes`, () => {
				const r = buildHandoffUrl({ to: 'regex', inputs: { pattern: value } });
				expect(r.ok, `builder failed: ${label}`).toBe(true);
				if (!r.ok) return;
				navigateTo(r.url);
				expect(readRegexState().pattern).toBe(value);
			});
		}
	});

	describe('via cron expression (param ?e=)', () => {
		// cron's `e` accepts arbitrary text via URLSearchParams; the same
		// character classes round-trip here even though most aren't
		// meaningful in cron expressions semantically. This is the bar's
		// "every character class survives every registered recipient" check,
		// not a semantic-validity claim.
		for (const [label, value] of CASES) {
			it(`${label}: round-trip preserves bytes`, () => {
				const r = buildHandoffUrl({
					to: 'cron',
					inputs: { expression: value }
				});
				expect(r.ok, `builder failed: ${label}`).toBe(true);
				if (!r.ok) return;
				navigateTo(r.url);
				expect(readCronState().expression).toBe(value);
			});
		}
	});
});
