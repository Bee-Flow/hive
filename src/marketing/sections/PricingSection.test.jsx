/**
 * The monthly/yearly toggle must be honest.
 *
 * The live billing config currently exposes a single €0 plan, and the block
 * still rendered a Monthly/Yearly segmented control above it — flipping it
 * switched between "the plan" and "no plans available", which reads as a
 * broken shop. The rule pinned here: the toggle renders only when the loaded
 * plans genuinely cover BOTH intervals; with no real choice the one existing
 * interval wins regardless of the editor's configured default.
 *
 * Run: cd agent-hub && npx vitest run src/marketing/sections/PricingSection.test.jsx
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import Pricing from './PricingSection';

const plan = (over = {}) => ({
    id: 'p1',
    name: 'Bee Flow - Nextcloud - Free',
    price: 0,
    currency: 'EUR',
    planType: 'organization',
    billingInterval: 'monthly',
    allowedFeatures: [],
    ...over,
});

function mockPlans(plans) {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ plans }),
    })));
}

afterEach(() => vi.unstubAllGlobals());

describe('the billing-interval toggle', () => {
    it('is hidden when there is only one plan', async () => {
        mockPlans([plan()]);
        const { container } = render(<Pricing data={{ enabled: true }} />);
        await screen.findByText('Bee Flow - Nextcloud - Free');
        expect(container.querySelector('.pricing-toggle')).toBeNull();
    });

    it('is hidden when every plan sits on the same interval', async () => {
        mockPlans([plan(), plan({ id: 'p2', name: 'Team' })]);
        const { container } = render(<Pricing data={{ enabled: true }} />);
        await screen.findByText('Team');
        expect(container.querySelector('.pricing-toggle')).toBeNull();
    });

    it('renders once plans cover both intervals', async () => {
        mockPlans([
            plan(),
            plan({ id: 'p2', name: 'Team yearly', billingInterval: 'yearly', price: 490 }),
        ]);
        const { container } = render(<Pricing data={{ enabled: true }} />);
        await screen.findByText('Bee Flow - Nextcloud - Free');
        expect(container.querySelector('.pricing-toggle')).not.toBeNull();
    });

    it('never strands the only plan behind a yearly default', async () => {
        // Editor set defaultInterval: 'yearly'; billing only has a monthly
        // plan. Without the pin, the page showed the empty-state text while
        // the toggle that could reveal the plan was hidden.
        mockPlans([plan()]);
        const { container } = render(
            <Pricing data={{ enabled: true, defaultInterval: 'yearly' }} />,
        );
        await screen.findByText('Bee Flow - Nextcloud - Free');
        expect(container.querySelector('.pricing-empty')).toBeNull();
    });
});
