import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import useCmsHead from './useCmsHead';

const resolveAssetUrl = (k) => (k?.startsWith('cms/') ? `/api/cms/asset/${k}` : k);

function Probe(props) {
    useCmsHead({ resolveAssetUrl, ...props });
    return null;
}

const q = (sel) => document.head.querySelector(sel);

beforeEach(() => {
    document.head.querySelectorAll('[data-cms-head]').forEach(el => el.remove());
    document.title = 'App';
});

describe('useCmsHead', () => {
    it('sets title, description, og tags, robots and favicon', () => {
        render(<Probe
            enabled
            pageTitle="Pricing"
            seo={{ metaTitle: 'Acme Pricing', metaDescription: 'Plans & prices', ogImage: 'cms/og.png', noIndex: true }}
            favicon="cms/fav.png"
        />);
        expect(document.title).toBe('Acme Pricing');
        expect(q('meta[name="description"][data-cms-head]').getAttribute('content')).toBe('Plans & prices');
        expect(q('meta[property="og:title"][data-cms-head]').getAttribute('content')).toBe('Acme Pricing');
        expect(q('meta[property="og:image"][data-cms-head]').getAttribute('content'))
            .toBe(new URL('/api/cms/asset/cms/og.png', window.location.origin).href);
        expect(q('meta[name="robots"][data-cms-head]').getAttribute('content')).toBe('noindex');
        expect(q('link[rel="icon"][data-cms-head]').getAttribute('href')).toBe('/api/cms/asset/cms/fav.png');
    });

    it('falls back to the page title and reconciles on page change (empty values remove tags)', () => {
        const { rerender } = render(<Probe enabled pageTitle="About" seo={{ metaDescription: 'About us' }} />);
        expect(document.title).toBe('About');
        expect(q('meta[name="description"][data-cms-head]')).toBeTruthy();
        expect(q('meta[name="robots"][data-cms-head]')).toBeNull();

        rerender(<Probe enabled pageTitle="Contact" seo={{}} />);
        expect(document.title).toBe('Contact');
        expect(q('meta[name="description"][data-cms-head]')).toBeNull();
        expect(q('meta[property="og:image"][data-cms-head]')).toBeNull();
    });

    it('is a no-op in editor preview', () => {
        render(<Probe enabled={false} pageTitle="X" seo={{ metaTitle: 'Nope' }} favicon="cms/f.png" />);
        expect(document.title).toBe('App');
        expect(document.head.querySelectorAll('[data-cms-head]').length).toBe(0);
    });
});
