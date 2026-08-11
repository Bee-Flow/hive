import { describe, expect, it } from 'vitest';
import { diffDefinitions } from './draftDiff';
import { KITCHEN_SINK } from '../state/sampleDefinitions';

const clone = (v) => JSON.parse(JSON.stringify(v));

describe('diffDefinitions', () => {
    it('returns empty sets for identical definitions (even different object graphs)', () => {
        const diff = diffDefinitions(KITCHEN_SINK, clone(KITCHEN_SINK));
        expect(diff.addedIds.size).toBe(0);
        expect(diff.changedIds.size).toBe(0);
        expect(diff.addedOnScreens.size).toBe(0);
    });

    it('detects an added component and the screen it landed on', () => {
        const next = clone(KITCHEN_SINK);
        next.screens[0].sections[0].children.push({
            id: 'cmp_newbtn', type: 'button', visible: true,
            props: { label: 'Ping', variant: 'primary', role: 'button' },
            style: { span: 3, size: 'md', align: 'start' },
        });

        const diff = diffDefinitions(KITCHEN_SINK, next);
        expect(diff.addedIds).toEqual(new Set(['cmp_newbtn']));
        expect(diff.addedOnScreens).toEqual(new Set(['scr_dash01']));
        // The parent section only changed through its children — not "changed".
        expect(diff.changedIds.size).toBe(0);
    });

    it('detects nodes added inside containers (nested children)', () => {
        const next = clone(KITCHEN_SINK);
        const card = next.screens[0].sections[2].children[0];
        card.children.push({
            id: 'cmp_nested', type: 'text', visible: true,
            props: { text: 'Deep', muted: false },
            style: { span: 12, align: 'start', color: null, weight: 'regular' },
        });

        const diff = diffDefinitions(KITCHEN_SINK, next);
        expect(diff.addedIds.has('cmp_nested')).toBe(true);
        expect(diff.addedOnScreens.has('scr_dash01')).toBe(true);
        expect(diff.changedIds.has(card.id)).toBe(false);
    });

    it('marks a node changed when its own props change, without flagging ancestors', () => {
        const next = clone(KITCHEN_SINK);
        next.screens[0].sections[0].children[0].props.text = 'Renamed dashboard';

        const diff = diffDefinitions(KITCHEN_SINK, next);
        expect(diff.addedIds.size).toBe(0);
        expect(diff.changedIds).toEqual(new Set(['cmp_headg1']));
        expect(diff.addedOnScreens.size).toBe(0);
    });

    it('a new screen counts as an addition on itself (with its nodes)', () => {
        const next = clone(KITCHEN_SINK);
        next.screens.push({
            id: 'scr_extra1', name: 'Settings', icon: null, showInNav: true, maxWidth: 'medium',
            sections: [{
                id: 'sec_extra1', style: { padding: 4, gap: 3, background: 'none' },
                children: [{
                    id: 'cmp_extra1', type: 'heading', visible: true,
                    props: { text: 'Settings', level: 2 },
                    style: { span: 12, align: 'start', color: null },
                }],
            }],
        });

        const diff = diffDefinitions(KITCHEN_SINK, next);
        expect(diff.addedIds).toEqual(new Set(['scr_extra1', 'sec_extra1', 'cmp_extra1']));
        expect(diff.addedOnScreens).toEqual(new Set(['scr_extra1']));
    });

    it('added actions are ids without a screen', () => {
        const next = clone(KITCHEN_SINK);
        next.actions.act_newer1 = { kind: 'toast', message: 'Hi', tone: 'info' };

        const diff = diffDefinitions(KITCHEN_SINK, next);
        expect(diff.addedIds).toEqual(new Set(['act_newer1']));
        expect(diff.addedOnScreens.size).toBe(0);
    });

    it('marks a changed action', () => {
        const next = clone(KITCHEN_SINK);
        next.actions.act_toast1 = { ...next.actions.act_toast1, message: 'Different' };

        const diff = diffDefinitions(KITCHEN_SINK, next);
        expect(diff.changedIds).toEqual(new Set(['act_toast1']));
    });

    it('treats everything as added when prev is null (fresh app)', () => {
        const diff = diffDefinitions(null, KITCHEN_SINK);
        expect(diff.addedIds.has('scr_dash01')).toBe(true);
        expect(diff.addedIds.has('cmp_form01')).toBe(true);
        expect(diff.addedIds.has('act_fetch1')).toBe(true);
        expect(diff.addedOnScreens).toEqual(new Set(['scr_dash01', 'scr_form01']));
    });

    it('handles a null next definition', () => {
        const diff = diffDefinitions(KITCHEN_SINK, null);
        expect(diff.addedIds.size).toBe(0);
        expect(diff.changedIds.size).toBe(0);
        expect(diff.addedOnScreens.size).toBe(0);
    });
});
