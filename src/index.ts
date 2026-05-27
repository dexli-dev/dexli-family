// Public API surface for @dexli/family. Bar item 9: this file's exports are
// EXHAUSTIVE. Anything not exported here is internal and may change without
// contract bump.

export {
	FAMILY,
	isFamilySlug,
	type FamilySibling,
	type FamilySlug
} from './family.config';
export {
	buildHandoffUrl,
	MAX_HANDOFF_URL_BYTES,
	type BuildHandoffOpts,
	type HandoffResult
} from './handoff';
