// Public-API-surface boundary test (bar items 9 + 10).
//
// Bar item 9: the public exports of @dexli/family are EXHAUSTIVE — family
// config (+ read accessors) and URL builder ONLY. Items explicitly NOT
// exposed in v1: envelope helpers, ?from= generators, inverse-parse
// helpers, programmatic-API scaffolding, auth-token forwarding, iframe
// embed helpers, postMessage stubs.
//
// TypeScript-erased types (FamilySlug, FamilySibling, HandoffResult,
// BuildHandoffOpts) don't appear at runtime — Object.keys reflects only
// runtime values. The set checked below is the runtime-value surface.

import { describe, expect, it } from 'vitest';
import * as publicApi from './index';

describe('public API surface (bar items 9, 10)', () => {
	const EXPECTED = ['FAMILY', 'isFamilySlug', 'buildHandoffUrl', 'MAX_HANDOFF_URL_BYTES'].sort();

	it('exports exactly the documented runtime values (and no more)', () => {
		const actual = Object.keys(publicApi).sort();
		expect(actual).toEqual(EXPECTED);
	});

	it('FAMILY is a value export (family config — bar item 9 "family config")', () => {
		expect(publicApi.FAMILY).toBeDefined();
		expect(typeof publicApi.FAMILY).toBe('object');
	});

	it('isFamilySlug is a value export (read accessor — bar item 9 "read accessors")', () => {
		expect(typeof publicApi.isFamilySlug).toBe('function');
	});

	it('buildHandoffUrl is a value export (URL builder — bar item 9 "URL builder")', () => {
		expect(typeof publicApi.buildHandoffUrl).toBe('function');
	});

	it('MAX_HANDOFF_URL_BYTES is a value export (builder cap constant)', () => {
		expect(typeof publicApi.MAX_HANDOFF_URL_BYTES).toBe('number');
		expect(publicApi.MAX_HANDOFF_URL_BYTES).toBe(4096);
	});

	it('exports no v2-and-beyond surface (envelope, ?from=, inverse parse, etc.)', () => {
		const FORBIDDEN = [
			'parseHandoffUrl',
			'extractHandoffSender',
			'createHandoffEnvelope',
			'parseHandoffEnvelope',
			'serializeHandoff',
			'deserializeHandoff',
			'buildFromParam',
			'getFromParam',
			'extractSender',
			'iframeHandoff',
			'createHandoffIframe',
			'embedHandoff',
			'postMessageHandoff',
			'sendHandoffMessage',
			'receiveHandoffMessage',
			'createHandoffApi',
			'handoffEndpoint',
			'forwardAuthToken',
			'attachAuth',
			'attachHandoffMetadata',
			'handoffTraceId',
			'recordHandoffTelemetry'
		];
		const present = new Set(Object.keys(publicApi));
		for (const name of FORBIDDEN) {
			expect(present.has(name), `forbidden export present: ${name}`).toBe(false);
		}
	});
});
