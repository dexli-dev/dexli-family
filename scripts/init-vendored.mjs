// npm postinstall hook for @dexli/family. Two jobs:
//
// 1. Ensure the vendored sibling-parser submodules are initialized + at
//    their pinned SHAs. The round-trip test suite (bar item 4) imports
//    each shipped sibling's actual production `src/lib/url-state.ts` by
//    reference; submodule content IS that canonical source at the pin.
//
// 2. Stub `.svelte-kit/tsconfig.json` inside each submodule. The siblings
//    are SvelteKit apps whose top-level `tsconfig.json` extends a
//    `svelte-kit sync`-generated file (`.svelte-kit/tsconfig.json`) that
//    doesn't exist in a bare submodule checkout. vite's tsconfck walks UP
//    from each transformed .ts file and crashes when the `extends` chain
//    can't resolve. An empty `{}` file is enough to satisfy tsconfck;
//    esbuild then transforms cleanly. We do NOT run `svelte-kit sync`
//    because that would drag the full SvelteKit dependency tree (kit +
//    adapter-node + svelte) into every install — wrong scope, we're
//    consuming TWO TS files, not running the sibling apps.
//
// Cross-platform: pure Node stdlib (child_process + fs + path), no
// platform-specific shell.

import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const SIBLINGS = ['cron-dexli', 'regex-dexli', 'diff-dexli'];

function run(cmd) {
	execSync(cmd, { cwd: REPO_ROOT, stdio: 'inherit' });
}

run('git submodule update --init --recursive');

for (const sibling of SIBLINGS) {
	const stubDir = resolve(REPO_ROOT, 'vendored', sibling, '.svelte-kit');
	const stubPath = resolve(stubDir, 'tsconfig.json');
	mkdirSync(stubDir, { recursive: true });
	writeFileSync(stubPath, '{}\n', 'utf8');
}

console.log(`[init-vendored] submodules initialized; ${SIBLINGS.length} svelte-kit stub(s) written.`);
