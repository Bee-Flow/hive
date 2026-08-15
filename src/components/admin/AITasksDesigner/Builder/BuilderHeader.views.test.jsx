import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import BuilderHeader from './BuilderHeader';

/**
 * The view switcher. Version history was a section at the bottom of Settings —
 * hard to find, and it kept Settings from growing (BFSF-344/341/342). "Build"
 * also read oddly next to Settings and Run history (BFSF-343).
 */
const props = (over = {}) => ({
    title: 'My routine',
    triggerKind: 'manual',
    isActive: false,
    isDraft: true,
    statusLabel: 'Draft',
    statusBadgeClass: '',
    tab: 'build',
    onTabChange: vi.fn(),
    onBack: vi.fn(),
    onRename: vi.fn(),
    ...over,
});

const openMenu = () => fireEvent.click(screen.getByRole('button', { expanded: false, name: /Editor|Settings|Runs|Saved versions/ }));

beforeEach(() => cleanup());

describe('BuilderHeader — view switcher', () => {
    it('calls the editing view "Editor" while keeping the build id', () => {
        const p = props();
        render(<BuilderHeader {...p} />);
        openMenu();
        fireEvent.click(screen.getByRole('menuitemradio', { name: 'Editor' }));
        expect(p.onTabChange).toHaveBeenCalledWith('build');
    });

    it('offers Saved versions as a view of its own, described but named by its label', () => {
        const p = props();
        render(<BuilderHeader {...p} />);
        openMenu();
        // Accessible NAMES are the labels alone (the descriptions under them
        // are aria-hidden display copy).
        expect(screen.getAllByRole('menuitemradio').map(el => el.getAttribute('aria-label')))
            .toEqual(['Editor', 'Settings', 'Runs', 'Saved versions']);
        fireEvent.click(screen.getByRole('menuitemradio', { name: 'Saved versions' }));
        expect(p.onTabChange).toHaveBeenCalledWith('versions');
    });

    it('shows the current view on the closed button', () => {
        render(<BuilderHeader {...props({ tab: 'versions' })} />);
        expect(screen.getByRole('button', { name: 'Saved versions' })).toBeTruthy();
    });
});
