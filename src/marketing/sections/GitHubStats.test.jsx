/**
 * GitHub-stats band — fail-soft is the contract.
 *
 * The numbers come from /api/public/github-stats, which is allowed to 404 or
 * 503 (upstream rate limits). The degraded rendering is the repo-link chip
 * alone: no zeroes, no spinner that never resolves, no error UI. That
 * behavior is what these tests pin.
 *
 * Run: cd agent-hub && npx vitest run src/marketing/sections/GitHubStats.test.jsx
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import GitHubStats from './GitHubStats';

const data = {
    enabled: true,
    repoUrl: 'https://github.com/Bee-Flow/Bee-Flow-AI',
    linkLabel: 'Source on GitHub',
};

function mockStats(payload, ok = true) {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
        ok,
        json: () => Promise.resolve(payload),
    })));
}

afterEach(() => vi.unstubAllGlobals());

it('shows the star count and latest release once the endpoint answers', async () => {
    mockStats({
        stars: 12345,
        forks: 321,
        latestRelease: { tag: 'v1.8.0', publishedAt: '2026-07-01T00:00:00Z' },
        url: data.repoUrl,
    });
    render(<GitHubStats data={data} />);

    // Intl.NumberFormat groups the count (locale decides the separator).
    const stars = await screen.findByText(new Intl.NumberFormat().format(12345));
    expect(stars).toBeInTheDocument();
    expect(screen.getByText('v1.8.0')).toBeInTheDocument();
    expect(screen.getByText('Source on GitHub').closest('a'))
        .toHaveAttribute('href', data.repoUrl);
});

it('renders only the link chip when the endpoint fails', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('down'))));
    const { container } = render(<GitHubStats data={data} />);

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.getByText('Source on GitHub')).toBeInTheDocument();
    expect(container.querySelectorAll('.github-stats-chip')).toHaveLength(1);
});

it('renders only the link chip on a non-2xx response', async () => {
    mockStats({}, false);
    const { container } = render(<GitHubStats data={data} />);

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(container.querySelectorAll('.github-stats-chip')).toHaveLength(1);
});

it('skips the release chip when there is no release', async () => {
    mockStats({ stars: 10, forks: 1, latestRelease: null, url: data.repoUrl });
    const { container } = render(<GitHubStats data={data} />);

    await screen.findByText(new Intl.NumberFormat().format(10));
    // Stars + link, no release chip.
    expect(container.querySelectorAll('.github-stats-chip')).toHaveLength(2);
});
