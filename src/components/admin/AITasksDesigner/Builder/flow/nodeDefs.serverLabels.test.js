// @vitest-environment node
//
// Lockstep tripwire: the name a node gets when the AI BUILDER adds it
// (server/automation/builderTools.js) must match the name it gets when a person
// drags it off the palette (flow/nodeDefs.js `defaultLabel`).
//
// These two have always been written out separately, and they drifted: the
// palette said "Remove Duplicates", the drop scaffold "Remove duplicates" and
// the editor header "Dedupe" — three names for one node, depending on how it
// got onto the canvas. Renaming the catalog without this test would simply
// re-open that gap across the CJS/ESM boundary, where nothing can be shared.
//
// It reads builderTools.js as SOURCE rather than require()ing it: that module
// pulls in the store layer, and the thing under test is a set of string
// literals. The scan is asserted non-empty so a refactor that changes the shape
// fails loudly instead of passing vacuously.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { NODE_DEFS } from './nodeDefs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BUILDER_TOOLS = path.resolve(HERE, '../../../../../../../server/automation/builderTools.js');

/**
 * Types whose server label is deliberately different, with the reason. Anything
 * NOT listed here has to agree.
 */
const EXEMPT = {
    // Built from the bound path — "Loop over steps.s1.output.results" tells the
    // reader more than a static name, and only the server knows it at add time.
    loop: 'server composes a contextual label from overRef',
    // The AI builder names these after the tool / flowlet / Step it just chose.
    integration_action: 'named after the chosen tool',
    call_layer: 'named after the target flowlet',
    // Two palette entries, one step type: the server picks by mode.
    form_page: 'label depends on mode (input vs ending)',
};

/** type → the literal in `label: args.label || '<literal>'`. */
function serverDefaultLabels() {
    const src = fs.readFileSync(BUILDER_TOOLS, 'utf8');
    const out = new Map();
    // `type: 'summarize', ... label: args.label || 'Summarize'` — the type and
    // the label sit in the same object literal, so pair them per statement.
    for (const m of src.matchAll(/type:\s*'([a-z_]+)'[^;]*?label:\s*args\.label\s*\|\|\s*'([^']+)'/g)) {
        if (!out.has(m[1])) out.set(m[1], m[2]);
    }
    return out;
}

describe('nodeDefs ↔ server builderTools default labels', () => {
    const server = serverDefaultLabels();

    it('the source scan finds the labels at all', () => {
        expect(server.size, `no labels parsed out of ${BUILDER_TOOLS} — the scan has gone stale`).toBeGreaterThan(8);
    });

    it('every non-exempt type is named the same on both sides', () => {
        const drift = [];
        for (const [type, serverLabel] of server) {
            if (EXEMPT[type]) continue;
            const ours = NODE_DEFS[type]?.defaultLabel;
            if (!ours) continue; // covered by nodeDefs.test.js
            if (ours !== serverLabel) drift.push(`${type}: nodeDefs "${ours}" vs builderTools "${serverLabel}"`);
        }
        expect(drift, 'a node must have ONE name however it got onto the canvas').toEqual([]);
    });

    it('every exemption names a type the server actually labels', () => {
        for (const type of Object.keys(EXEMPT)) {
            expect(server.has(type) || NODE_DEFS[type], `${type} is exempted but neither side knows it`).toBeTruthy();
        }
    });
});
