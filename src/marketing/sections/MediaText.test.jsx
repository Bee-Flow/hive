/**
 * Media + Text must not publish a placeholder.
 *
 * Every branch of its renderMedia() draws something — a framed skeleton when
 * `frame` is set, an "Add an image in the panel" box otherwise — so a block
 * written without art put one of those on the public site with no warning.
 * Nine of them shipped on the Bee Flow site before anyone noticed, because
 * nothing in the authoring path says "you left this empty".
 *
 * Features and Steps already skip an empty media slot. These tests pin the
 * same rule here, and pin the one place a placeholder is still correct: the
 * CMS editor's preview, where it is the affordance telling you an image goes
 * there.
 *
 * Run: cd agent-hub && npx vitest run src/marketing/sections/MediaText.test.jsx
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import MediaText from './MediaText';

const base = {
    enabled: true,
    heading: 'Automation with a brake pedal',
    body: 'Approval steps hold anything irreversible until a person agrees.',
    cta: null,
    mediaPosition: 'right',
    mediaSize: 'half',
    backgroundVariant: 'default',
};

// Relative, so jsdom's configured origin is preserved — an absolute URL with
// a different host throws SecurityError.
function setPreview(on) {
    window.history.replaceState({}, '', on ? '?preview=1' : '?');
}

afterEach(() => setPreview(false));

describe('on the published site', () => {
    it('renders text-only when the media slot is empty', () => {
        const { container } = render(
            <MediaText data={{ ...base, media: { kind: 'image', src: '', alt: '', frame: 'hairline' } }} />
        );

        expect(screen.getByText(base.heading)).toBeInTheDocument();
        expect(container.querySelector('.media-text-block-media')).toBeNull();
        expect(container.querySelector('.media-text-block-inner--no-media')).not.toBeNull();
    });

    it('shows no "Add an image" prompt to a visitor', () => {
        render(<MediaText data={{ ...base, media: { kind: 'image', src: '', alt: '', frame: '' } }} />);
        expect(screen.queryByText(/Add an image/i)).toBeNull();
    });

    it('treats whitespace as empty — a stray space is not an image', () => {
        const { container } = render(
            <MediaText data={{ ...base, media: { kind: 'image', src: '   ', alt: '', frame: 'hairline' } }} />
        );
        expect(container.querySelector('.media-text-block-media')).toBeNull();
    });

    it('still renders the media column when there IS an image', () => {
        const { container } = render(
            <MediaText data={{ ...base, media: { kind: 'image', src: 'cms/shot.png', alt: 'A screenshot', frame: 'hairline' } }} />
        );
        expect(container.querySelector('.media-text-block-media')).not.toBeNull();
        expect(container.querySelector('.media-text-block-inner--no-media')).toBeNull();
    });

    it('keeps the layout knobs when media is present', () => {
        const { container } = render(
            <MediaText data={{ ...base, mediaSize: 'two-thirds', media: { kind: 'image', src: 'cms/shot.png', alt: '', frame: '' } }} />
        );
        expect(container.querySelector('.media-text-block-inner--size-two-thirds')).not.toBeNull();
        expect(container.querySelector('.media-text-block-inner--position-right')).not.toBeNull();
    });
});

describe('in the CMS editor preview', () => {
    it('keeps the placeholder, because that is where it is an affordance', () => {
        setPreview(true);
        const { container } = render(
            <MediaText data={{ ...base, media: { kind: 'image', src: '', alt: '', frame: '' } }} />
        );
        expect(container.querySelector('.media-text-block-media')).not.toBeNull();
        expect(screen.getByText(/Add an image/i)).toBeInTheDocument();
    });
});
