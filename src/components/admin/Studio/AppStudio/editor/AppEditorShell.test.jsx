import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render as rtlRender, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The component palette reads the session-cached component catalog for its
// per-card descriptions, so the shell needs the QueryClient it always has
// around it in the app. Shadowing `render` keeps every case below unchanged.
const render = (ui, options) => rtlRender(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        {ui}
    </QueryClientProvider>,
    options,
);


// The inspector is a sibling module with its own tests — mock it to keep this
// suite about the shell composition.
vi.mock('../inspector/InspectorPanel', () => ({
    default: ({ onCommit }) => <div data-testid="inspector-panel" data-has-commit={typeof onCommit === 'function'} />,
}));

vi.mock('../studioAppsApi', () => {
    const api = {
        saveDefinition: vi.fn().mockResolvedValue({ ok: true, version: 4, warnings: [], repairs: [] }),
        updateApp: vi.fn().mockResolvedValue({}),
        publish: vi.fn().mockResolvedValue({}),
        listVersions: vi.fn().mockResolvedValue({ versions: [] }),
        restoreVersion: vi.fn().mockResolvedValue({}),
        getApp: vi.fn().mockResolvedValue({}),
    };
    return { studioAppsApi: api, default: api };
});

import AppEditorShell from './AppEditorShell';
import { useEditorChrome } from './EditorChromeContext';
import { useAppEditor } from '../state/AppEditorContext';
import { BLANK_APP, KITCHEN_SINK } from '../state/sampleDefinitions';
import { studioAppsApi } from '../studioAppsApi';

const app = {
    id: 'app-1',
    name: 'Kitchen sink',
    definition: KITCHEN_SINK,
    version: 3,
    isPublished: false,
};

describe('AppEditorShell', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // clearAllMocks keeps implementations, so a save shape set by one test
        // would otherwise leak into the next.
        studioAppsApi.saveDefinition.mockResolvedValue({ ok: true, version: 4, warnings: [], repairs: [] });
    });

    it('renders the header controls, tabs, canvas and mocked inspector', () => {
        render(<AppEditorShell app={app} onClose={vi.fn()} />);

        expect(screen.getByText('Kitchen sink')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Redo' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Version history' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /publish/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Close editor' })).toBeInTheDocument();
        expect(screen.getByRole('toolbar', { name: 'Add a component' })).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: 'Edit' })).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: 'Preview' })).toBeInTheDocument();

        // Screen tabs + canvas content from the fixture.
        expect(screen.getByText('Dashboard')).toBeInTheDocument();
        // 'New request' exists as a tab AND as a canvas button label.
        expect(screen.getAllByText('New request').length).toBeGreaterThanOrEqual(2);
        expect(screen.getByText('Team dashboard')).toBeInTheDocument();

        // Mocked inspector received onCommit.
        expect(screen.getByTestId('inspector-panel')).toHaveAttribute('data-has-commit', 'true');
    });

    it('starts with undo and redo disabled', () => {
        render(<AppEditorShell app={app} onClose={vi.fn()} />);
        expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled();
    });

    it('click-to-add from the palette commits into history (undo becomes possible)', async () => {
        render(<AppEditorShell app={app} onClose={vi.fn()} />);

        // The component ribbon is always visible in edit mode — click the Heading card.
        // The ribbon shows one category at a time — Heading lives under Content.
        fireEvent.click(screen.getByRole('tab', { name: 'Content' }));
        fireEvent.click(screen.getByTitle(/^Heading — click to add/));

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Undo' })).not.toBeDisabled();
        });
        // The new node landed on the canvas: the fixture's dashboard now has
        // a second default "Heading" text besides the existing headings.
        expect(screen.getAllByText('Heading').length).toBeGreaterThan(0);
    });

    it('shows the collapsed AI rail without a chatSlot and the slot content with one', () => {
        const { unmount } = render(<AppEditorShell app={app} onClose={vi.fn()} />);
        expect(screen.getByLabelText('AI assistant (coming soon)')).toBeInTheDocument();
        unmount();

        render(<AppEditorShell app={app} onClose={vi.fn()} chatSlot={<div data-testid="chat-slot" />} />);
        expect(screen.getByTestId('chat-slot')).toBeInTheDocument();
        expect(screen.queryByLabelText('AI assistant (coming soon)')).not.toBeInTheDocument();
    });

    it('flushes pending saves and calls onClose when closing', async () => {
        const onClose = vi.fn();
        render(<AppEditorShell app={app} onClose={onClose} />);
        fireEvent.click(screen.getByRole('button', { name: 'Close editor' }));
        await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });

    it('keeps the editor open when the closing flush could not save (Bug 2)', async () => {
        studioAppsApi.saveDefinition.mockResolvedValue({
            ok: false, invalid: true, errors: [{ message: 'Screen name is required' }],
        });
        const onClose = vi.fn();
        render(<AppEditorShell app={app} onClose={onClose} />);

        fireEvent.click(screen.getByRole('tab', { name: 'Content' }));
        fireEvent.click(screen.getByTitle(/^Heading — click to add/));
        await waitFor(() => expect(screen.getByRole('button', { name: 'Undo' })).not.toBeDisabled());

        fireEvent.click(screen.getByRole('button', { name: 'Close editor' }));
        await waitFor(() => expect(studioAppsApi.saveDefinition).toHaveBeenCalled(), { timeout: 2500 });
        // The work is still on screen and the reason is shown — closing here
        // would have thrown the unsaved edit away without a word.
        expect(onClose).not.toHaveBeenCalled();
        expect(await screen.findByText('Screen name is required')).toBeInTheDocument();
    });

    it('restore adopts the server definitionVersion as the next save base (Bug 3)', async () => {
        const restored = JSON.parse(JSON.stringify(KITCHEN_SINK));
        restored.screens[0].name = 'Restored dashboard';
        studioAppsApi.listVersions.mockResolvedValue({
            versions: [{ id: 'ver-7', version: 7, createdAt: '2026-01-01T10:00:00.000Z' }],
        });
        // What the API really returns (sanitizeAppRow): definitionVersion, no `version`.
        studioAppsApi.getApp.mockResolvedValue({
            app: { id: 'app-1', name: 'Kitchen sink', definition: restored, definitionVersion: 12 },
        });
        studioAppsApi.saveDefinition.mockResolvedValue({ ok: true, version: 13, warnings: [], repairs: [] });
        render(<AppEditorShell app={app} onClose={vi.fn()} />);

        fireEvent.click(screen.getByRole('button', { name: 'Version history' }));
        fireEvent.click(await screen.findByRole('button', { name: /Restore/ }));
        await waitFor(() => expect(screen.getByText('Restored dashboard')).toBeInTheDocument());

        // The next edit must save against 12 — with a stale base every save
        // comes back as a conflict.
        fireEvent.click(screen.getByRole('tab', { name: 'Content' }));
        fireEvent.click(screen.getByTitle(/^Heading — click to add/));
        await waitFor(() => expect(studioAppsApi.saveDefinition).toHaveBeenCalled(), { timeout: 2500 });
        expect(studioAppsApi.saveDefinition.mock.calls[0][2]).toBe(12);
    });

    it('labels the command palette with the key THIS keyboard has (Bug 9)', () => {
        render(<AppEditorShell app={app} onClose={vi.fn()} />);
        // jsdom reports a non-Mac platform, so the hint must read Ctrl+K.
        const launcher = screen.getByRole('button', { name: 'Open command palette' });
        expect(launcher).toHaveAttribute('title', 'Command palette (Ctrl+K)');
        expect(launcher).toHaveTextContent('Ctrl+K');
    });

    it('a blank page explains the real UI and offers starter chips (Bug 10)', async () => {
        render(<AppEditorShell app={{ ...app, definition: BLANK_APP }} onClose={vi.fn()} />);

        expect(await screen.findByText(/Drag a component from the strip above/)).toBeInTheDocument();
        // Nothing in this UI is called "Add" — the old copy pointed at a ghost.
        expect(screen.queryByText(/pick one from Add/)).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Add heading' }));
        await waitFor(() => expect(screen.getByRole('button', { name: 'Undo' })).not.toBeDisabled());
        // The chip inserted through the normal path, so the placeholder is gone.
        expect(screen.queryByText(/Drag a component from the strip above/)).toBeNull();
    });

    it('conflict "Load latest" adopts the server definition but KEEPS undo history (Bug 2)', async () => {
        const serverDef = JSON.parse(JSON.stringify(KITCHEN_SINK));
        serverDef.screens[0].name = 'Server dashboard';
        studioAppsApi.saveDefinition.mockResolvedValue({
            ok: false, conflict: true, currentVersion: 9, definition: serverDef,
        });
        render(<AppEditorShell app={app} onClose={vi.fn()} />);

        // Make an edit so there is real undo history to preserve.
        // The ribbon shows one category at a time — Heading lives under Content.
        fireEvent.click(screen.getByRole('tab', { name: 'Content' }));
        fireEvent.click(screen.getByTitle(/^Heading — click to add/));
        await waitFor(() => expect(screen.getByRole('button', { name: 'Undo' })).not.toBeDisabled());

        // The autosave debounce fires → conflict → the conflict dialog appears.
        const loadLatest = await screen.findByRole('button', { name: 'Load latest' }, { timeout: 2500 });
        fireEvent.click(loadLatest);

        // Server definition adopted…
        await waitFor(() => expect(screen.getByText('Server dashboard')).toBeInTheDocument());
        // …and undo history is preserved (the dialog promises this).
        expect(screen.getByRole('button', { name: 'Undo' })).not.toBeDisabled();
    });

    it('conflict "Overwrite with mine" ignores a double-click and saves the edited def once (Bug 4)', async () => {
        const serverDef = JSON.parse(JSON.stringify(KITCHEN_SINK));
        let releaseOverwrite;
        studioAppsApi.saveDefinition
            .mockResolvedValueOnce({ ok: false, conflict: true, currentVersion: 9, definition: serverDef })
            .mockImplementation(() => new Promise((r) => {
                releaseOverwrite = () => r({ ok: true, version: 11, warnings: [], repairs: [] });
            }));
        render(<AppEditorShell app={app} onClose={vi.fn()} />);

        // Edit so autosave has a dirty definition to save.
        // The ribbon shows one category at a time — Heading lives under Content.
        fireEvent.click(screen.getByRole('tab', { name: 'Content' }));
        fireEvent.click(screen.getByTitle(/^Heading — click to add/));
        await waitFor(() => expect(screen.getByRole('button', { name: 'Undo' })).not.toBeDisabled());

        // Debounce fires → conflict dialog (exactly one save so far: the conflict).
        const overwriteBtn = await screen.findByRole('button', { name: /Overwrite/i }, { timeout: 2500 });
        await waitFor(() => expect(studioAppsApi.saveDefinition).toHaveBeenCalledTimes(1));

        // Two rapid clicks before the dialog unmounts — the in-flight guard must
        // let only ONE overwrite through.
        fireEvent.click(overwriteBtn);
        fireEvent.click(overwriteBtn);
        await waitFor(() => expect(studioAppsApi.saveDefinition).toHaveBeenCalledTimes(2));

        releaseOverwrite();
        // Still exactly two calls (1 conflict + 1 overwrite) after settling.
        await waitFor(() => expect(studioAppsApi.saveDefinition).toHaveBeenCalledTimes(2));
        // The overwrite persisted the EDITED definition (with the added heading),
        // captured at click time — not a stale/empty one.
        const countNodes = (def) => {
            let n = 0;
            const walk = (kids) => { for (const k of kids || []) { n++; if (k.children) walk(k.children); } };
            for (const s of def.screens) for (const sec of s.sections) walk(sec.children);
            return n;
        };
        const overwriteArgs = studioAppsApi.saveDefinition.mock.calls[1];
        expect(countNodes(overwriteArgs[1])).toBeGreaterThan(countNodes(KITCHEN_SINK));
        expect(overwriteArgs[2]).toBe(9); // saved against the server's current version
    });

    // The whole point of these: the server writes plain-English feedback on
    // every save and the shell used to drop it on the floor.
    describe('save feedback', () => {
        const addAHeading = async () => {
            fireEvent.click(screen.getByRole('tab', { name: 'Content' }));
            fireEvent.click(screen.getByTitle(/^Heading — click to add/));
            await waitFor(() => expect(screen.getByRole('button', { name: 'Undo' })).not.toBeDisabled());
        };

        it('shows the server warnings on the save pill and jumps to the node behind one', async () => {
            studioAppsApi.saveDefinition.mockResolvedValue({
                ok: true,
                version: 4,
                warnings: [{
                    code: 'binding.table_unset',
                    path: 'screens[0].sections[0].children[0]',
                    message: 'This list has no table picked yet.',
                    hint: 'Pick a table before people use the app.',
                }],
                repairs: [],
            });
            render(<AppEditorShell app={app} onClose={vi.fn()} />);
            await addAHeading();

            const pill = await screen.findByRole('button', { name: /1 thing to check/ }, { timeout: 2500 });
            fireEvent.click(pill);
            expect(screen.getByText('This list has no table picked yet.')).toBeInTheDocument();
            expect(screen.getByText('Pick a table before people use the app.')).toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: 'Show me' }));
            const target = KITCHEN_SINK.screens[0].sections[0].children[0].id;
            await waitFor(() => {
                expect(document.querySelector(`[data-node-id="${target}"]`)).toHaveAttribute('data-selected');
            });
        });

        it('counts repairs too and stays silent when the save was clean', async () => {
            studioAppsApi.saveDefinition.mockResolvedValue({
                ok: true,
                version: 4,
                warnings: [{ path: 'meta.name', message: 'The app has no description yet.' }],
                repairs: [{ code: 'style.clamped', path: 'screens[0]', message: 'A width was outside the allowed range and was set back.' }],
            });
            const { unmount } = render(<AppEditorShell app={app} onClose={vi.fn()} />);
            await addAHeading();
            await screen.findByRole('button', { name: /2 things to check/ }, { timeout: 2500 });
            unmount();

            studioAppsApi.saveDefinition.mockClear();
            studioAppsApi.saveDefinition.mockResolvedValue({ ok: true, version: 4, warnings: [], repairs: [] });
            render(<AppEditorShell app={app} onClose={vi.fn()} />);
            await addAHeading();
            await screen.findByText('Saved', undefined, { timeout: 2500 });
            expect(screen.queryByText(/to check/)).toBeNull();
        });

        it('never shows an entry that would leak an internal role token', async () => {
            studioAppsApi.saveDefinition.mockResolvedValue({
                ok: true,
                version: 4,
                warnings: [
                    { path: 'screens[0]', message: 'This screen is hidden from everyone.' },
                    { path: 'screens[0]', message: 'visibleToRoles contains "__nobody__".' },
                ],
                repairs: [],
            });
            render(<AppEditorShell app={app} onClose={vi.fn()} />);
            await addAHeading();

            const pill = await screen.findByRole('button', { name: /1 thing to check/ }, { timeout: 2500 });
            fireEvent.click(pill);
            expect(screen.getByText('This screen is hidden from everyone.')).toBeInTheDocument();
            expect(screen.queryByText(/__nobody__/)).toBeNull();
        });

        it('keeps every validation error from a rejected save, not just the first', async () => {
            studioAppsApi.saveDefinition.mockResolvedValue({
                ok: false,
                invalid: true,
                errors: [
                    { path: 'screens[0]', message: 'Screen name is required' },
                    { path: 'screens[0].sections[0].children[0]', message: 'This button has no action.', hint: 'Pick what it should do.' },
                ],
                warnings: [],
            });
            render(<AppEditorShell app={app} onClose={vi.fn()} />);
            await addAHeading();

            expect(await screen.findByText('Screen name is required', undefined, { timeout: 2500 })).toBeInTheDocument();
            fireEvent.click(screen.getByRole('button', { name: 'All 2' }));
            expect(screen.getByText('This button has no action.')).toBeInTheDocument();
            expect(screen.getByText('Pick what it should do.')).toBeInTheDocument();
        });
    });

    describe('publish button', () => {
        it('says nothing about being current when publishedVersion is missing', () => {
            render(<AppEditorShell app={{ ...app, isPublished: true }} onClose={vi.fn()} />);
            expect(screen.getByRole('button', { name: /^Publish$/ })).toBeInTheDocument();
            expect(screen.queryByText(/up to date/)).toBeNull();
        });

        it('offers "Publish changes" while the live version is behind', () => {
            render(<AppEditorShell app={{ ...app, isPublished: true, publishedVersion: 2 }} onClose={vi.fn()} />);
            const btn = screen.getByRole('button', { name: /Publish changes/ });
            expect(btn).toHaveAttribute('title', expect.stringContaining('older than what you see here'));
        });

        it('says "Published — up to date" when the live version matches', () => {
            render(<AppEditorShell app={{ ...app, isPublished: true, publishedVersion: 3 }} onClose={vi.fn()} />);
            expect(screen.getByRole('button', { name: /Published — up to date/ })).toBeInTheDocument();
        });
    });

    it('admits that a role preview does not filter the data (Bug 3)', () => {
        const withRoles = { ...KITCHEN_SINK, roles: [{ id: 'staff', name: 'Staff' }] };
        render(<AppEditorShell app={{ ...app, definition: withRoles }} onClose={vi.fn()} />);

        expect(screen.getByText('Viewing as:')).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('View as role'), { target: { value: 'staff' } });

        const banner = document.querySelector('[data-preview-role-banner="staff"]');
        expect(banner.textContent).toContain('Lists and tables still show everything you can see');
        expect(banner.textContent).toContain('own rows once they open the app themselves');
    });

    it('records a whole AI turn (lock → transient drafts → commitTurn) as ONE undo step', async () => {
        // Simulates BuilderChatPane's integration through the chrome handle:
        // lock, apply transient drafts (plain set_definition), then commitTurn.
        const DRAFT = JSON.parse(JSON.stringify(KITCHEN_SINK));
        DRAFT.screens[0].sections[0].children.push({
            id: 'cmp_aibtn1', type: 'heading', visible: true,
            props: { text: 'AI added heading', level: 2 },
            style: { span: 12, align: 'start', color: null },
        });

        function FakeAIPane() {
            const { dispatch } = useAppEditor();
            const chrome = useEditorChrome();
            return (
                <div>
                    <button
                        type="button"
                        onClick={() => dispatch({ type: 'set_stream_lock', streamLock: true })}
                    >
                        ai-lock
                    </button>
                    <button
                        type="button"
                        onClick={() => dispatch({ type: 'set_definition', definition: DRAFT })}
                    >
                        ai-draft
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            chrome.commitTurn(DRAFT);
                            chrome.markSaved(DRAFT, 9);
                            dispatch({ type: 'set_stream_lock', streamLock: false });
                        }}
                    >
                        ai-done
                    </button>
                </div>
            );
        }

        render(<AppEditorShell app={app} onClose={vi.fn()} chatSlot={<FakeAIPane />} />);
        expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();

        fireEvent.click(screen.getByRole('button', { name: 'ai-lock' }));
        fireEvent.click(screen.getByRole('button', { name: 'ai-draft' }));
        // Transient draft is on the canvas but NOT in history.
        expect(screen.getByText('AI added heading')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();

        fireEvent.click(screen.getByRole('button', { name: 'ai-done' }));
        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Undo' })).not.toBeDisabled();
        });
        expect(screen.getByText('AI added heading')).toBeInTheDocument();

        // One Cmd+Z undoes the whole AI turn back to the pre-turn definition.
        fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
        await waitFor(() => {
            expect(screen.queryByText('AI added heading')).not.toBeInTheDocument();
        });
        // markSaved adopted the server-persisted draft: nothing was re-saved
        // by autosave at the moment the turn completed.
        expect(studioAppsApi.saveDefinition).not.toHaveBeenCalledWith(
            'app-1', DRAFT, expect.anything(),
        );
    });
});

describe('AppEditorShell — inspector column', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        studioAppsApi.saveDefinition.mockResolvedValue({ ok: true, version: 4, warnings: [], repairs: [] });
        window.localStorage?.clear?.();
    });

    it('the inspector can be collapsed, giving its width back to the canvas', () => {
        // A fixed 320px column is not a layout decision, it is the absence of
        // one: too narrow for a binding editor, too wide when you are only
        // nudging spans.
        render(<AppEditorShell app={app} onClose={vi.fn()} />);
        expect(screen.getByRole('complementary', { name: 'Inspector' })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Collapse the inspector' }));
        expect(screen.queryByRole('complementary', { name: 'Inspector' })).toBeNull();

        // …and back, from a rail that is still on screen.
        fireEvent.click(screen.getByRole('button', { name: 'Show the inspector' }));
        expect(screen.getByRole('complementary', { name: 'Inspector' })).toBeInTheDocument();
    });

    it('the inspector is resizable, and the panel owns its width exactly once', () => {
        render(<AppEditorShell app={app} onClose={vi.fn()} />);
        const separator = screen.getByRole('separator', { name: 'Resize the inspector' });
        expect(separator).toBeInTheDocument();

        // Keyboard resize (the drag path shares this handler).
        fireEvent.keyDown(separator, { key: 'ArrowLeft' });
        expect(Number(separator.getAttribute('aria-valuenow'))).toBeGreaterThan(320);

        // ONE element owns the width. The inspector used to render a second
        // <aside> inside this one — two borders, two scroll containers, and two
        // different widths (320px outside, w-80 inside) fighting each other.
        expect(screen.getAllByRole('complementary', { name: 'Inspector' })).toHaveLength(1);
    });
});
