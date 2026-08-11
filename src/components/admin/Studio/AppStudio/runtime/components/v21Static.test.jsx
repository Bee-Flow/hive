import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import AppBadgeList from './AppBadgeList';
import AppContainer from './AppContainer';
import AppMarkdown, { parseBlocks } from './AppMarkdown';
import AppPageHeader from './AppPageHeader';
import AppProgress from './AppProgress';
import AppTimeline from './AppTimeline';
import { RuntimeProvider, buildScope, DEFAULT_RUNTIME } from '../RuntimeContext';

function withRuntime(ui, overrides = {}) {
    const value = { ...DEFAULT_RUNTIME, scope: buildScope({ now: '2026-01-01T00:00:00.000Z' }), ...overrides };
    return render(<RuntimeProvider value={value}>{ui}</RuntimeProvider>);
}

const node = (type, props, extra = {}) => ({ id: `cmp_${type}`, type, visible: true, props, style: { span: 12 }, ...extra });

describe('AppContainer', () => {
    it('renders children on its own 12-column grid, chrome-free', () => {
        const { container } = withRuntime(
            <AppContainer node={node('container', {}, { style: { span: 6, gap: 2 } })}>
                <div data-testid="kid">hi</div>
            </AppContainer>,
        );
        const grid = container.querySelector('[data-app-container]');
        expect(grid).toBeTruthy();
        expect(grid.className).toContain('app-grid');
        expect(grid.style.gridTemplateColumns).toBe('repeat(12, minmax(0, 1fr))');
        expect(grid.querySelector('[data-testid="kid"]')).toBeTruthy();
    });
});

describe('AppPageHeader', () => {
    it('renders title/subtitle, right-aligned action children and the divider', () => {
        const { container, getByText } = withRuntime(
            <AppPageHeader node={node('page_header', { title: 'Projects', subtitle: 'All of them', icon: 'LayoutGrid', showDivider: true })}>
                <button type="button">New project</button>
            </AppPageHeader>,
        );
        expect(getByText('Projects').tagName).toBe('H1');
        expect(getByText('All of them')).toBeTruthy();
        expect(container.querySelector('[data-app-pageheader-actions]')).toBeTruthy();
        expect(getByText('New project')).toBeTruthy();
        expect(container.querySelector('hr')).toBeTruthy();
    });

    it('omits the divider when showDivider is false', () => {
        const { container } = withRuntime(
            <AppPageHeader node={node('page_header', { title: 'T', subtitle: null, icon: null, showDivider: false })} />,
        );
        expect(container.querySelector('hr')).toBeNull();
    });
});

describe('AppMarkdown', () => {
    it('parses headings, lists, code fences and paragraphs into blocks', () => {
        const blocks = parseBlocks('# Title\n\nPara **bold**.\n\n- one\n- two\n\n1. first\n2) second\n\n```js\nconst x = 1;\n```');
        expect(blocks.map((b) => b.kind)).toEqual(['heading', 'p', 'ul', 'ol', 'code']);
        expect(blocks[0]).toMatchObject({ level: 1, text: 'Title' });
        expect(blocks[2].items).toEqual(['one', 'two']);
        expect(blocks[4].code).toBe('const x = 1;');
    });

    it('renders block markdown with inline formatting and safe links', () => {
        const md = '## Docs\n\nSee [the site](https://example.com) and **bold**.\n\n- item A\n\n```\ncode here\n```';
        const { container, getByText } = withRuntime(<AppMarkdown node={node('markdown', { content: md })} />);
        expect(container.querySelector('h2')).toBeTruthy();
        const a = container.querySelector('a');
        expect(a.getAttribute('href')).toBe('https://example.com');
        expect(a.getAttribute('rel')).toContain('noopener');
        expect(container.querySelector('strong')).toBeTruthy();
        expect(getByText('item A')).toBeTruthy();
        expect(container.querySelector('pre code').textContent).toBe('code here');
    });
});

describe('AppBadgeList', () => {
    const rows = [
        { label: 'Open', tone: 'open' },
        { label: 'Closed', tone: 'closed' },
    ];

    it('renders one badge per row with colorMap-driven roles', () => {
        const { container, getByText } = withRuntime(
            <AppBadgeList node={node('badge_list', {
                source: { kind: 'static', value: rows },
                labelKey: 'label',
                colorKey: 'tone',
                colorMap: [{ value: 'open', color: 'success' }],
                emptyText: 'x',
            })} />,
        );
        expect(getByText('Open').getAttribute('data-badge-role')).toBe('success');
        expect(getByText('Closed').getAttribute('data-badge-role')).toBeNull();
        expect(container.querySelectorAll('[data-app-badgelist] > span').length).toBe(2);
    });

    it('shows emptyText when the binding resolves empty', () => {
        const { getByText } = withRuntime(
            <AppBadgeList node={node('badge_list', { source: { kind: 'static', value: [] }, labelKey: 'label', colorKey: null, colorMap: [], emptyText: 'No tags yet.' })} />,
        );
        expect(getByText('No tags yet.')).toBeTruthy();
    });
});

describe('AppProgress', () => {
    it('renders a clamped bar with a percent caption from a formula binding', () => {
        const { container } = withRuntime(
            <AppProgress node={node('progress', { value: { kind: 'formula', expr: '30 + 15' }, max: 100, format: 'percent', label: 'Done', tone: 'success' })} />,
        );
        const bar = container.querySelector('[role="progressbar"]');
        expect(bar.getAttribute('aria-valuenow')).toBe('45');
        expect(bar.firstChild.style.width).toBe('45%');
        expect(container.querySelector('[data-app-progress-caption]').textContent).toBe('45%');
    });

    it('fraction format + clamping above max', () => {
        const { container } = withRuntime(
            <AppProgress node={node('progress', { value: { kind: 'static', value: 12 }, max: 10, format: 'fraction', label: null, tone: 'primary' })} />,
        );
        expect(container.querySelector('[data-app-progress-caption]').textContent).toBe('10 / 10');
        expect(container.querySelector('[role="progressbar"]').firstChild.style.width).toBe('100%');
    });
});

describe('AppTimeline', () => {
    const rows = [
        { title: 'Created', at: '2026-01-01', note: 'first' },
        { title: 'Updated', at: '2026-01-02', note: 'second' },
        { title: 'Closed', at: '2026-01-03', note: 'third' },
    ];
    const tlNode = (extra = {}) => node('timeline', {
        source: { kind: 'static', value: rows }, titleKey: 'title', dateKey: 'at',
        descriptionKey: 'note', icon: null, rowLimit: 2, emptyText: 'x',
    }, extra);

    it('renders rows up to rowLimit with title/description', () => {
        const { container, getByText, queryByText } = withRuntime(<AppTimeline node={tlNode()} />);
        expect(container.querySelectorAll('[data-app-timeline-row]').length).toBe(2);
        expect(getByText('Created')).toBeTruthy();
        expect(getByText('second')).toBeTruthy();
        expect(queryByText('Closed')).toBeNull(); // beyond rowLimit
    });

    it('fires onRowClick with the row as form values (run mode)', () => {
        let fired = null;
        const runAction = (actionId, opts) => { fired = { actionId, opts }; };
        const { getByText } = withRuntime(
            <AppTimeline node={tlNode({ onRowClick: 'act_row001' })} />,
            { mode: 'run', runAction },
        );
        getByText('Updated').closest('button').click();
        expect(fired.actionId).toBe('act_row001');
        expect(fired.opts.formValues).toEqual(rows[1]);
    });
});
