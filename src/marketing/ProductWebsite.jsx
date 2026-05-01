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

/**
 * Public product website. Renders enabled sections in canonical order from
 * the CMS content tree. When mounted with `?preview=1`, listens for
 * `cms-preview` postMessage events from the admin panel and swaps content
 * in real time without a server round-trip.
 */
export default function ProductWebsite({ content: initialContent }) {
    const rootRef = useRef(null);
    const [content, setContent] = useState(initialContent || {});

    useEffect(() => { setContent(initialContent || {}); }, [initialContent]);

    // Preview-mode listener — admin panel posts {type: 'cms-preview', content}.
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (!params.has('preview')) return;
        const onMessage = (e) => {
            if (e.data?.type === 'cms-preview' && e.data.content) {
                setContent(e.data.content);
            }
        };
        window.addEventListener('message', onMessage);
        // Tell the parent we're ready to receive
        window.parent?.postMessage({ type: 'cms-preview-ready' }, '*');
        return () => window.removeEventListener('message', onMessage);
    }, []);

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
