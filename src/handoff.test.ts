import { describe, expect, it } from 'vitest';
import { buildHandoffUrl, MAX_HANDOFF_URL_BYTES } from './handoff';

describe('buildHandoffUrl — happy path (bar items 1, 3)', () => {
	it('composes a cron URL with expression + tz', () => {
		const r = buildHandoffUrl({
			to: 'cron',
			inputs: { expression: '0 9 * * 1-5', tz: 'Europe/Oslo' }
		});
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		const url = new URL(r.url);
		expect(url.origin).toBe('https://cron.dexli.dev');
		expect(url.pathname).toBe('/');
		expect(url.searchParams.get('e')).toBe('0 9 * * 1-5');
		expect(url.searchParams.get('tz')).toBe('Europe/Oslo');
	});

	it('composes a regex URL with pattern + text + flags', () => {
		const r = buildHandoffUrl({
			to: 'regex',
			inputs: { pattern: '\\d+', text: 'order 42', flags: 'gi' }
		});
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		const url = new URL(r.url);
		expect(url.searchParams.get('p')).toBe('\\d+');
		expect(url.searchParams.get('t')).toBe('order 42');
		expect(url.searchParams.get('f')).toBe('gi');
	});

	it('uses ONLY recipient native params — no envelope, no _handoff_*, no _family_*, no ?from=', () => {
		const r = buildHandoffUrl({
			to: 'regex',
			inputs: { pattern: 'x', text: 'y', flags: 'g' }
		});
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		const url = new URL(r.url);
		const keys = Array.from(url.searchParams.keys()).sort();
		expect(keys).toEqual(['f', 'p', 't']);
		for (const key of keys) {
			expect(key.startsWith('_')).toBe(false);
			expect(key).not.toBe('from');
		}
	});

	it('composes a webhook URL (empty inputs map) — origin + path only', () => {
		const r = buildHandoffUrl({ to: 'webhook' });
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(r.url).toBe('https://webhook.dexli.dev/');
	});

	it('omitting inputs entirely treats them as empty', () => {
		const r = buildHandoffUrl({ to: 'cron' });
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(r.url).toBe('https://cron.dexli.dev/');
	});

	it('subset of recipient inputs is allowed — only provided fields appear', () => {
		const r = buildHandoffUrl({
			to: 'cron',
			inputs: { expression: '*/5 * * * *' }
		});
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		const url = new URL(r.url);
		expect(url.searchParams.get('e')).toBe('*/5 * * * *');
		expect(url.searchParams.has('tz')).toBe(false);
	});
});

describe('buildHandoffUrl — failure signals (bar item 7)', () => {
	it('unknown recipient slug → unknown-recipient with slug echoed', () => {
		const r = buildHandoffUrl({ to: 'fxchart' });
		expect(r.ok).toBe(false);
		if (r.ok) return;
		expect(r.kind).toBe('unknown-recipient');
		if (r.kind !== 'unknown-recipient') return;
		expect(r.slug).toBe('fxchart');
	});

	it('empty slug → unknown-recipient', () => {
		const r = buildHandoffUrl({ to: '' });
		expect(r.ok).toBe(false);
		if (r.ok) return;
		expect(r.kind).toBe('unknown-recipient');
	});

	it('case-mismatched slug is unknown (slugs are case-sensitive)', () => {
		const r = buildHandoffUrl({ to: 'CRON' });
		expect(r.ok).toBe(false);
		if (r.ok) return;
		expect(r.kind).toBe('unknown-recipient');
	});

	it('unknown field for known recipient → unknown-field with both names', () => {
		const r = buildHandoffUrl({ to: 'cron', inputs: { foo: 'bar' } });
		expect(r.ok).toBe(false);
		if (r.ok) return;
		expect(r.kind).toBe('unknown-field');
		if (r.kind !== 'unknown-field') return;
		expect(r.recipient).toBe('cron');
		expect(r.field).toBe('foo');
	});

	it('webhook (empty input map) + any input field → unknown-field', () => {
		const r = buildHandoffUrl({ to: 'webhook', inputs: { body: 'x' } });
		expect(r.ok).toBe(false);
		if (r.ok) return;
		expect(r.kind).toBe('unknown-field');
		if (r.kind !== 'unknown-field') return;
		expect(r.recipient).toBe('webhook');
		expect(r.field).toBe('body');
	});

	it('first unknown field is reported (deterministic short-circuit)', () => {
		const r = buildHandoffUrl({
			to: 'cron',
			inputs: { expression: 'ok', mystery: 'bad' }
		});
		expect(r.ok).toBe(false);
		if (r.ok) return;
		expect(r.kind).toBe('unknown-field');
		if (r.kind !== 'unknown-field') return;
		expect(r.field).toBe('mystery');
	});

	it('non-string value → non-text-value with field name', () => {
		const r = buildHandoffUrl({
			to: 'regex',
			inputs: { pattern: 123 as unknown as string }
		});
		expect(r.ok).toBe(false);
		if (r.ok) return;
		expect(r.kind).toBe('non-text-value');
		if (r.kind !== 'non-text-value') return;
		expect(r.field).toBe('pattern');
	});

	it('rejects every non-string runtime type with non-text-value', () => {
		const cases: Array<[string, unknown]> = [
			['number', 42],
			['boolean', true],
			['null', null],
			['undefined', undefined],
			['object', { x: 1 }],
			['array', [1, 2, 3]],
			['Uint8Array', new Uint8Array([1, 2, 3])],
			['ArrayBuffer', new ArrayBuffer(4)]
		];
		for (const [label, value] of cases) {
			const r = buildHandoffUrl({
				to: 'regex',
				inputs: { pattern: value as unknown as string }
			});
			expect(r.ok, `${label} should be rejected`).toBe(false);
			if (r.ok) continue;
			expect(r.kind, `${label} should produce non-text-value`).toBe('non-text-value');
		}
	});

	it('empty-string value is accepted (text, length zero — not non-text)', () => {
		const r = buildHandoffUrl({ to: 'regex', inputs: { pattern: '' } });
		expect(r.ok).toBe(true);
	});
});

describe('buildHandoffUrl — length cap on FINAL encoded URL (bar item 6)', () => {
	it('exposes the cap as a public constant', () => {
		expect(MAX_HANDOFF_URL_BYTES).toBe(4096);
	});

	it('accepts inputs that produce a URL exactly at cap', () => {
		const prefix = 'https://regex.dexli.dev/?t=';
		const room = MAX_HANDOFF_URL_BYTES - prefix.length;
		const text = 'a'.repeat(room);
		const r = buildHandoffUrl({ to: 'regex', inputs: { text } });
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(r.url.length).toBe(MAX_HANDOFF_URL_BYTES);
	});

	it('over-cap → over-cap signal carrying measured length + cap', () => {
		const text = 'a'.repeat(MAX_HANDOFF_URL_BYTES);
		const r = buildHandoffUrl({ to: 'regex', inputs: { text } });
		expect(r.ok).toBe(false);
		if (r.ok) return;
		expect(r.kind).toBe('over-cap');
		if (r.kind !== 'over-cap') return;
		expect(r.length).toBeGreaterThan(MAX_HANDOFF_URL_BYTES);
		expect(r.cap).toBe(MAX_HANDOFF_URL_BYTES);
	});

	it('measures FINAL encoded URL, not raw input length', () => {
		// Pure '&' inflates 3x via URL encoding ('&' → '%26').
		// prefix 'https://regex.dexli.dev/?t=' = 27 bytes
		// Each '&' encodes to 3 bytes
		// 27 + 3 * n > 4096  ⇒  n > 1356.33
		const rawText = '&'.repeat(1400);
		// Raw input is 1400 bytes — well under cap. Encoded is what overruns.
		expect(rawText.length).toBeLessThan(MAX_HANDOFF_URL_BYTES);
		const r = buildHandoffUrl({ to: 'regex', inputs: { text: rawText } });
		expect(r.ok).toBe(false);
		if (r.ok) return;
		expect(r.kind).toBe('over-cap');
		if (r.kind !== 'over-cap') return;
		expect(r.length).toBeGreaterThan(MAX_HANDOFF_URL_BYTES);
	});

	it('caller-detectable across the boundary — never returns unbounded URLs', () => {
		const prefix = 'https://regex.dexli.dev/?t=';
		const room = MAX_HANDOFF_URL_BYTES - prefix.length;
		for (let n = room - 5; n <= room + 5; n++) {
			const r = buildHandoffUrl({
				to: 'regex',
				inputs: { text: 'x'.repeat(n) }
			});
			if (r.ok) {
				expect(r.url.length).toBeLessThanOrEqual(MAX_HANDOFF_URL_BYTES);
			} else {
				expect(r.kind).toBe('over-cap');
			}
		}
	});

	it('does not throw on extremely large inputs — over-cap signal still returns', () => {
		const huge = 'x'.repeat(MAX_HANDOFF_URL_BYTES * 4);
		expect(() => buildHandoffUrl({ to: 'regex', inputs: { text: huge } })).not.toThrow();
		const r = buildHandoffUrl({ to: 'regex', inputs: { text: huge } });
		expect(r.ok).toBe(false);
		if (r.ok) return;
		expect(r.kind).toBe('over-cap');
	});
});
