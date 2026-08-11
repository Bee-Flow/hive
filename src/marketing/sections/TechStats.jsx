import React, { useEffect, useRef, useState } from 'react';
import SectionHeader from '../components/SectionHeader';
import EditableText from '../components/EditableText';
import SectionFrame from '../components/SectionFrame';
import { sectionBgClass } from './sectionBg';
import { inlineTextStyle } from './textStyle';

const isPreview = () =>
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('preview');

// Count-up numeral for the public site. Parses the leading number out of
// the stat string ("12,000+" → 12000, prefix ""/suffix "+" kept verbatim)
// and eases it in when the stat scrolls into view. Never used in preview
// (contentEditable must show the real text) and skipped under
// prefers-reduced-motion — both fall back to the static string.
function CountUpNumber({ text, className, style }) {
    const ref = useRef(null);
    const [display, setDisplay] = useState(text);
    useEffect(() => {
        setDisplay(text);
        const m = /^([^0-9]*)([0-9][0-9.,]*)(.*)$/.exec(String(text || ''));
        if (!m) return undefined;
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
        const target = parseFloat(m[2].replace(/,/g, ''));
        if (!Number.isFinite(target) || target === 0) return undefined;
        const el = ref.current;
        if (!el) return undefined;
        const decimals = (m[2].split('.')[1] || '').length;
        const grouped = m[2].includes(',');
        let raf;
        const obs = new IntersectionObserver((entries) => {
            if (!entries.some(e => e.isIntersecting)) return;
            obs.disconnect();
            const t0 = performance.now();
            const dur = 700;
            const step = (t) => {
                const p = Math.min(1, (t - t0) / dur);
                const eased = 1 - Math.pow(1 - p, 3);
                let v = (target * eased).toFixed(decimals);
                if (grouped) v = Number(v).toLocaleString('en-US');
                setDisplay(`${m[1]}${v}${m[3]}`);
                if (p < 1) raf = requestAnimationFrame(step);
            };
            raf = requestAnimationFrame(step);
        }, { threshold: 0.4 });
        obs.observe(el);
        return () => { obs.disconnect(); if (raf) cancelAnimationFrame(raf); };
    }, [text]);
    return <div ref={ref} className={className} style={style}>{display}</div>;
}

export default function TechStats({ data }) {
    if (!data?.enabled) return null;
    const countUp = data.countUp !== false && !isPreview();
    return (
        <SectionFrame id="techStats" name="Stats" enabled={data.enabled}>
            <section id="tech-stats" className={sectionBgClass(data, 'alt-bg')}>
                <div className="container">
                    <SectionHeader
                        pathPrefix="techStats"
                        eyebrow={data.eyebrow} title={data.title} lead=""
                        eyebrowStyle={data.eyebrowStyle} titleStyle={data.titleStyle}
                        eyebrowAlign={data.eyebrowAlign} titleAlign={data.titleAlign} align={data.align}
                    />
                    <div className="tech-stats">
                        {(data.stats || []).map((stat, i) => (
                            <div key={i} className={`tech-stat reveal reveal-delay-${Math.min(i + 1, 6)}`}>
                                {countUp ? (
                                    <CountUpNumber
                                        text={stat.number || ''}
                                        className="number tnum"
                                        style={inlineTextStyle(stat.numberStyle, stat.numberAlign)}
                                    />
                                ) : (
                                <EditableText
                                    as="div"
                                    path={`techStats.stats.${i}.number`}
                                    multiline
                                    placeholder="99%"
                                    className="number tnum"
                                    style={inlineTextStyle(stat.numberStyle, stat.numberAlign)}
                                >
                                    {stat.number || ''}
                                </EditableText>
                                )}
                                <EditableText
                                    as="div"
                                    path={`techStats.stats.${i}.label`}
                                    multiline
                                    placeholder="Label"
                                    className="label-text"
                                    style={inlineTextStyle(undefined, stat.labelAlign)}
                                >
                                    {stat.label || ''}
                                </EditableText>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </SectionFrame>
    );
}
