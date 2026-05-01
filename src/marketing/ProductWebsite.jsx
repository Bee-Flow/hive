import React, { useEffect, useRef, useState } from 'react';
import './marketing.css';

import Header       from './sections/Header';
import Hero         from './sections/Hero';
import SocialProof  from './sections/SocialProof';
import Features     from './sections/Features';
import Steps        from './sections/Steps';
import Security     from './sections/Security';
import Integrations from './sections/Integrations';
import Architecture from './sections/Architecture';
import TechStats    from './sections/TechStats';
import CTA          from './sections/CTA';
import Footer       from './sections/Footer';

import { useScrollReveal } from './components/ScrollReveal';

const isPreviewMode = () =>
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('preview');

/**
 * Public product website. Renders enabled sections in canonical order from
 * the CMS content tree.
 *
 * Preview mode (?preview=1):
 *   - Receives `cms-preview` postMessage with structural changes from the panel.
 *   - Each text node becomes a click-to-edit `EditableText` that posts
 *     `cms-edit` events back to the panel on blur.
 *   - Each section is wrapped in a `SectionFrame` that exposes a hover
 *     toolbar for quick actions (focus settings, toggle visibility) which
 *     post `cms-section-action` events.
 */
export default function ProductWebsite({ content: initialContent }) {
    const rootRef = useRef(null);
    const [content, setContent] = useState(initialContent || {});
    const [activeSection, setActiveSection] = useState(null);

    useEffect(() => { setContent(initialContent || {}); }, [initialContent]);

    // Preview-mode listener — admin panel posts structural updates and
    // active-section highlights.
    useEffect(() => {
        if (!isPreviewMode()) return;
        const onMessage = (e) => {
            if (e.data?.type === 'cms-preview' && e.data.content) {
                setContent(e.data.content);
            }
            if (e.data?.type === 'cms-active-section') {
                setActiveSection(e.data.section || null);
            }
        };
        window.addEventListener('message', onMessage);
        // Mark the root with a class so CSS can adapt (e.g., un-fix the header).
        rootRef.current?.classList.add('cms-preview');
        // Tell the parent we're ready.
        window.parent?.postMessage({ type: 'cms-preview-ready' }, '*');
        return () => window.removeEventListener('message', onMessage);
    }, []);

    // Highlight the active section frame.
    useEffect(() => {
        if (!isPreviewMode() || !rootRef.current) return;
        const root = rootRef.current;
        root.querySelectorAll('.cms-section-frame.cms-section-active').forEach(el =>
            el.classList.remove('cms-section-active')
        );
        if (activeSection) {
            const target = root.querySelector(`[data-cms-section="${activeSection}"]`);
            target?.classList.add('cms-section-active');
        }
    }, [activeSection, content]);

    useScrollReveal(rootRef);

    return (
        <div className="marketing-root" ref={rootRef}>
            <Header       data={content.header} />
            <Hero         data={content.hero} />
            <SocialProof  data={content.socialProof} />
            <Features     data={content.features} />
            <Steps        data={content.steps} />
            <Security     data={content.security} />
            <Integrations data={content.integrations} />
            <Architecture data={content.architecture} />
            <TechStats    data={content.techStats} />
            <CTA          data={content.cta} />
            <Footer       data={content.footer} />
        </div>
    );
}
