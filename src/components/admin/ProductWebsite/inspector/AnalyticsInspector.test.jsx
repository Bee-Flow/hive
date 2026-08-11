import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AnalyticsInspector from './AnalyticsInspector';

const siteWith = (analytics = {}, cookieBanner = { enabled: true }) => ({
    id: 'pj_1',
    analytics,
    cookieBanner,
});

const idInput = () => screen.getByPlaceholderText('G-XXXXXXXXXX');

describe('AnalyticsInspector', () => {
    it('commits a valid measurement ID on blur (uppercased)', () => {
        const onChange = vi.fn();
        render(<AnalyticsInspector site={siteWith()} onChange={onChange} />);
        fireEvent.change(idInput(), { target: { value: 'g-abcd1234' } });
        fireEvent.blur(idInput());
        expect(onChange).toHaveBeenCalledWith({ gaMeasurementId: 'G-ABCD1234' });
    });

    it('blocks an invalid ID with a message and reverts on blur', () => {
        const onChange = vi.fn();
        render(<AnalyticsInspector site={siteWith({ gaMeasurementId: 'G-OLD11111' })} onChange={onChange} />);
        // The input strips characters that can never appear in a measurement
        // ID, so an "invalid" draft is one that's structurally wrong (G-XX).
        fireEvent.change(idInput(), { target: { value: 'G-XX' } });
        expect(screen.getByText(/Not a GA4 measurement ID/)).toBeInTheDocument();
        fireEvent.blur(idInput());
        expect(onChange).not.toHaveBeenCalled();
        expect(idInput().value).toBe('G-OLD11111');
    });

    it('allows clearing the ID (disables GA)', () => {
        const onChange = vi.fn();
        render(<AnalyticsInspector site={siteWith({ gaMeasurementId: 'G-OLD11111' })} onChange={onChange} />);
        fireEvent.change(idInput(), { target: { value: '' } });
        fireEvent.blur(idInput());
        expect(onChange).toHaveBeenCalledWith({ gaMeasurementId: '' });
    });

    it('warns when the cookie banner is disabled and jumps to its settings', () => {
        const onOpenCookieSettings = vi.fn();
        render(
            <AnalyticsInspector
                site={siteWith({ gaMeasurementId: 'G-ABCD1234' }, { enabled: false })}
                onChange={vi.fn()}
                onOpenCookieSettings={onOpenCookieSettings}
            />,
        );
        expect(screen.getByText(/cookie banner is disabled/)).toBeInTheDocument();
        fireEvent.click(screen.getByText('Open cookie banner settings'));
        expect(onOpenCookieSettings).toHaveBeenCalled();
    });

    it('shows no banner warning without an ID or with the banner enabled', () => {
        const { rerender } = render(
            <AnalyticsInspector site={siteWith({}, { enabled: false })} onChange={vi.fn()} />,
        );
        expect(screen.queryByText(/cookie banner is disabled/)).toBeNull();
        rerender(
            <AnalyticsInspector site={siteWith({ gaMeasurementId: 'G-ABCD1234' }, { enabled: true })} onChange={vi.fn()} />,
        );
        expect(screen.queryByText(/cookie banner is disabled/)).toBeNull();
    });
});
