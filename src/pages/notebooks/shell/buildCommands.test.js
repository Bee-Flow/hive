import { describe, it, expect, vi } from 'vitest';
import buildCommands from './buildCommands';

// A fake editor whose chain() records the method names it receives.
function fakeEditor() {
    const ops = [];
    const chain = new Proxy({}, {
        get: (_t, prop) => {
            if (prop === 'run') return () => { ops.push('run'); return true; };
            return (...args) => { ops.push(args.length ? [String(prop), args] : String(prop)); return chain; };
        },
    });
    return { editor: { chain: () => chain }, ops };
}

describe('buildCommands', () => {
    it('format command runs focus + the right chain method + run', () => {
        const { editor, ops } = fakeEditor();
        const cmds = buildCommands({ editorRef: { current: { getEditor: () => editor } } });
        cmds.find(c => c.id === 'bold').run();
        expect(ops).toContain('focus');
        expect(ops.some(o => Array.isArray(o) ? o[0] === 'toggleBold' : o === 'toggleBold')).toBe(true);
        expect(ops).toContain('run');
    });

    it('heading commands pass the level', () => {
        const { editor, ops } = fakeEditor();
        const cmds = buildCommands({ editorRef: { current: { getEditor: () => editor } } });
        cmds.find(c => c.id === 'h2').run();
        const h = ops.find(o => Array.isArray(o) && o[0] === 'toggleHeading');
        expect(h?.[1]?.[0]).toEqual({ level: 2 });
    });

    it('a missing editor makes editor commands a safe no-op', () => {
        const cmds = buildCommands({ editorRef: { current: null } });
        expect(() => cmds.find(c => c.id === 'bold').run()).not.toThrow();
    });

    it('has no generation commands (the feature was removed)', () => {
        const cmds = buildCommands({});
        expect(cmds.some(c => c.id.startsWith('gen-'))).toBe(false);
        expect(cmds.some(c => c.group === 'Generate')).toBe(false);
    });

    it('sign/nextcloud export entries are hidden unless configured', () => {
        const cmds = buildCommands({ onExport: () => {}, hasExportContent: true, onSign: () => {}, onNextcloud: () => {}, signRequestConfigured: false, nextcloudConfigured: true });
        expect(cmds.find(c => c.id === 'export-sign').enabled).toBe(false);
        expect(cmds.find(c => c.id === 'export-nextcloud').enabled).toBe(true);
    });

    it('view toggles invoke the injected handlers', () => {
        const onToggleLeft = vi.fn();
        const onVersions = vi.fn();
        const cmds = buildCommands({ onToggleLeft, onVersions });
        cmds.find(c => c.id === 'toggle-sources').run();
        cmds.find(c => c.id === 'versions').run();
        expect(onToggleLeft).toHaveBeenCalledTimes(1);
        expect(onVersions).toHaveBeenCalledTimes(1);
    });
});
