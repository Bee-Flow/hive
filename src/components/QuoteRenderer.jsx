import React, { useState, useEffect } from 'react';
import html2pdf from 'html2pdf.js';
import './QuoteRenderer.css';
import { API_BASE, authFetch } from '../utils/helpers';

/**
 * QuoteRenderer - Renders professional quote/offerte documents
 * Uses company config from Rendering settings for branding
 */
const QuoteRenderer = ({ data, onClose }) => {
    const [checkedItems, setCheckedItems] = useState({});
    const [isAccepted, setIsAccepted] = useState(false);
    const [companyConfig, setCompanyConfig] = useState({});

    // Parse JSON if string
    const quote = typeof data === 'string' ? JSON.parse(data) : data;

    // Load company config from server
    useEffect(() => {
        authFetch(`${API_BASE}/ai/rendering-config`)
            .then(res => res.ok ? res.json() : {})
            .then(data => setCompanyConfig(data))
            .catch(() => { });
    }, []);

    // Handle acceptance
    const handleAccept = () => {
        const acceptance = quote.sections?.find(s => s.type === 'acceptance');
        if (acceptance?.checkboxes) {
            const allChecked = acceptance.checkboxes.every((_, idx) => checkedItems[`cb-${idx}`]);
            if (!allChecked) {
                alert('Vink alle voorwaarden aan om de offerte te accepteren.');
                return;
            }
        }
        setIsAccepted(true);
        alert('Offerte geaccepteerd! Een bevestiging wordt naar u verzonden.');
    };

    const handleDownloadPDF = () => {
        const element = document.querySelector('.quote-document');
        if (!element) return;

        const opt = {
            margin: [10, 10, 10, 10], // top, left, bottom, right in mm
            filename: `offerte-${quote.title.toLowerCase().replace(/\s+/g, '-')}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: ['css', 'legacy'] }
        };

        // Add class for print styling
        element.classList.add('pdf-mode');

        html2pdf()
            .set(opt)
            .from(element)
            .save()
            .then(() => {
                element.classList.remove('pdf-mode');
            });
    };

    const toggleCheckbox = (id) => {
        setCheckedItems(prev => ({ ...prev, [id]: !prev[id] }));
    };

    // Helper to render structured bullets array
    // Supports: strings, { text, note?, warning?, tip? }, and nested { text, bullets }
    const renderBullets = (bullets, className = '') => {
        if (!bullets || !Array.isArray(bullets)) return null;
        return (
            <ul className={className}>
                {bullets.map((item, i) => (
                    <li key={i}>
                        {typeof item === 'string' ? (
                            item
                        ) : (
                            <>
                                <span className="bullet-text">{item.text}</span>
                                {item.note && <span className="bullet-note"> ({item.note})</span>}
                                {item.warning && <span className="bullet-warning"> ⚠️ {item.warning}</span>}
                                {item.tip && <span className="bullet-tip"> 💡 {item.tip}</span>}
                                {item.bullets && renderBullets(item.bullets)}
                            </>
                        )}
                    </li>
                ))}
            </ul>
        );
    };

    // Helper to robustly render text that might be a string OR a structured object
    const renderSafeText = (content, className = '') => {
        if (!content) return null;
        if (typeof content === 'string') return <p className={className}>{content}</p>;
        if (Array.isArray(content)) return renderBullets(content);
        // If it's an object (like {text, note}), just render the text part
        return <p className={className}>{content.text || JSON.stringify(content)}</p>;
    };

    // Get company details from config
    const company = {
        name: quote.company || companyConfig.companyName || 'Company',
        logo: companyConfig.companyLogo || quote.companyLogo,
        details: companyConfig.companyDetails || '',
        address: companyConfig.companyAddress || '',
        email: companyConfig.companyEmail || '',
        phone: companyConfig.companyPhone || '',
        chamber: companyConfig.companyChamber || '',
        vat: companyConfig.companyVat || '',
        footer: companyConfig.defaultFooterText || ''
    };

    const renderSection = (section, idx) => {
        switch (section.type) {
            case 'specs':
                return (
                    <section key={idx} className="quote-section quote-specs">
                        <div className="specs-header">
                            <h2>{section.title || 'Project Specificaties'}</h2>
                            {company.logo && (
                                <div className="specs-logo">
                                    <img src={company.logo} alt={company.name} />
                                </div>
                            )}
                        </div>
                        <div className="specs-content">
                            <div className="specs-list">
                                {section.items?.map((item, i) => (
                                    <div key={i} className={`specs-item ${item.highlight ? 'highlight' : ''}`}>
                                        <span className="specs-label">{item.label}:</span>
                                        <span className="specs-value">{item.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                );

            case 'description':
                return (
                    <section key={idx} className="quote-section quote-description">
                        <h2>{section.title}</h2>
                        {section.intro && <div className="description-intro">{renderSafeText(section.intro)}</div>}
                        {/* Legacy: support old 'content' field as plain text */}
                        {section.content && !section.intro && <div className="description-intro">{renderSafeText(section.content)}</div>}

                        {section.features && (
                            <div className="features-grid">
                                {section.features.map((feature, i) => (
                                    <div key={i} className="feature-card">
                                        <div className="feature-icon">{feature.icon || '📋'}</div>
                                        <h3>{feature.title}</h3>
                                        {feature.intro && renderSafeText(feature.intro, "feature-intro")}
                                        {feature.bullets && renderBullets(feature.bullets)}
                                        {/* Legacy: support old 'description' as plain text */}
                                        {feature.description && !feature.bullets && renderSafeText(feature.description)}
                                    </div>
                                ))}
                            </div>
                        )}

                        {section.items && !section.features && (
                            <div className="description-items">
                                {section.items.map((item, i) => (
                                    <div key={i} className="description-item">
                                        <strong>{item.number}. {item.title}</strong>
                                        {item.intro && renderSafeText(item.intro)}
                                        {item.bullets && renderBullets(item.bullets)}
                                        {/* Legacy */}
                                        {item.description && !item.bullets && renderSafeText(item.description)}
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                );

            case 'phases':
                return (
                    <section key={idx} className="quote-section quote-phases">
                        <h2>{section.title}</h2>
                        <div className="phases-timeline">
                            {section.phases?.map((phase, i) => (
                                <div key={i} className="phase-item">
                                    <div className="phase-line-icon">
                                        <span className="phase-icon">{phase.icon || ['🔍', '⚙️', '✅'][i] || '📌'}</span>
                                    </div>
                                    <div className="phase-content-box">
                                        <h3>{phase.title}</h3>
                                        <div className="phase-description">
                                            {phase.goal && renderSafeText(phase.goal, "phase-goal-text")}
                                            {phase.actions && (
                                                <>
                                                    <p className="phase-actions-label"><strong>Acties:</strong></p>
                                                    {renderBullets(phase.actions)}
                                                </>
                                            )}
                                            {phase.deliverable && renderSafeText(phase.deliverable, "phase-deliverable-text")}
                                            {/* Legacy: support old 'description' as plain text */}
                                            {phase.description && !phase.actions && renderSafeText(phase.description)}
                                        </div>
                                        {phase.tip && (
                                            <div className="callout callout-info">
                                                <strong>Tip:</strong> {phase.tip}
                                            </div>
                                        )}
                                        {phase.warning && (
                                            <div className="callout callout-warning">
                                                <strong>Let op:</strong> {phase.warning}
                                            </div>
                                        )}
                                        {/* Legacy: support old warnings array */}
                                        {phase.warnings?.map((warn, j) => (
                                            <div key={j} className={`callout callout-${warn.type || 'info'}`}>
                                                <strong>{warn.label}:</strong> {warn.text}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                );

            case 'pricing':
                return (
                    <section key={idx} className="quote-section quote-pricing">
                        <h2>{section.title}</h2>
                        <div className="pricing-content">
                            {section.intro && <div className="pricing-intro">{renderSafeText(section.intro)}</div>}
                            {section.content && !section.intro && <div className="pricing-intro">{renderSafeText(section.content)}</div>}
                            {section.subsections?.map((sub, i) => (
                                <div key={i} className="pricing-subsection">
                                    <h3>{sub.title}</h3>
                                    {sub.intro && renderSafeText(sub.intro)}
                                    {sub.items?.map((item, j) => (
                                        <div key={j} className="pricing-item">
                                            <strong>{item.label}:</strong> <span>{item.value}</span>
                                            {item.note && <span className="item-note"> ({item.note})</span>}
                                        </div>
                                    ))}
                                    {sub.bullets && renderBullets(sub.bullets)}
                                </div>
                            ))}
                        </div>
                    </section>
                );

            case 'legal':
            case 'terms':
                return (
                    <section key={idx} className="quote-section quote-legal">
                        <h2>{section.title}</h2>
                        <div className="legal-content">
                            {section.intro && renderSafeText(section.intro)}
                            {section.content && !section.intro && renderSafeText(section.content)}
                            {section.subsections?.map((sub, i) => (
                                <div key={i} className="legal-subsection">
                                    <h3>{sub.title}</h3>
                                    {sub.intro && renderSafeText(sub.intro)}
                                    {sub.bullets && renderBullets(sub.bullets)}
                                    {/* Legacy: support old items array */}
                                    {sub.items && !sub.bullets && (
                                        <ul>
                                            {sub.items.map((item, j) => (
                                                <li key={j}>
                                                    {typeof item === 'string'
                                                        ? item
                                                        : <><strong>{item.label}:</strong> {item.value}</>
                                                    }
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>
                );

            case 'acceptance':
                // Legacy support - render as signature instead
                return (
                    <section key={idx} className="quote-section quote-signature-section">
                        <h2>{section.title || 'Ondertekening'}</h2>
                        <p className="signature-intro">Door ondertekening van deze offerte gaat u akkoord met de voorwaarden.</p>
                        <div className="signature-boxes">
                            <div className="signature-box">
                                <p className="signature-box-label">Opdrachtnemer</p>
                                <div className="signature-line"></div>
                                <p className="signature-box-sublabel">Naam: {company.name}</p>
                                <p className="signature-box-sublabel">Datum: ____-____-________</p>
                            </div>
                            <div className="signature-box">
                                <p className="signature-box-label">Opdrachtgever</p>
                                <div className="signature-line"></div>
                                <p className="signature-box-sublabel">Naam: _______________________</p>
                                <p className="signature-box-sublabel">Datum: ____-____-________</p>
                            </div>
                        </div>
                    </section>
                );

            case 'signature':
                return (
                    <section key={idx} className="quote-section quote-signature-section">
                        <h2>{section.title || 'Ondertekening'}</h2>
                        <div className="signature-boxes">
                            <div className="signature-box">
                                <p className="signature-box-label">Voor akkoord opdrachtnemer</p>
                                <div className="signature-line"></div>
                                <p className="signature-box-sublabel">Handtekening</p>
                                <p className="signature-box-sublabel">Datum: ____-____-________</p>
                            </div>
                            <div className="signature-box">
                                <p className="signature-box-label">Voor akkoord opdrachtgever</p>
                                <div className="signature-line"></div>
                                <p className="signature-box-sublabel">Handtekening</p>
                                <p className="signature-box-sublabel">Datum: ____-____-________</p>
                            </div>
                        </div>
                    </section>
                );

            default:
                return (
                    <section key={idx} className="quote-section">
                        <h2>{section.title}</h2>
                        {section.intro && <p>{section.intro}</p>}
                        {section.content && !section.intro && <p>{section.content}</p>}
                        {section.bullets && renderBullets(section.bullets)}
                    </section>
                );
        }
    };

    return (
        <div className="quote-wrapper">
            <div className="quote-container">
                <div className="quote-header-bar">
                    <span className="quote-label">📄 Offerte</span>
                    <div className="quote-actions">
                        <button
                            className="btn-toggle active"
                            onClick={handleDownloadPDF}
                        >
                            Export to PDF
                        </button>
                    </div>
                </div>

                <div className="quote-document-wrapper">
                    <div className="quote-document">
                        {/* Document Header */}
                        <header className="quote-header">
                            <h1>{quote.title}</h1>
                            {quote.subtitle && <p className="quote-subtitle">{quote.subtitle}</p>}
                        </header>

                        {/* Sections */}
                        {quote.sections?.map((section, idx) => renderSection(section, idx))}

                        {/* Footer with Company Details from Config */}
                        <footer className="quote-footer">
                            <div className="footer-company-info">
                                <p className="footer-company-name">{quote.footer?.company || company.name}</p>
                                {company.details && <p className="footer-details">{company.details}</p>}
                                {company.address && <p className="footer-address">{company.address}</p>}
                                <div className="footer-contact">
                                    {company.email && <span>{company.email}</span>}
                                    {company.email && company.phone && <span className="sep">|</span>}
                                    {company.phone && <span>{company.phone}</span>}
                                </div>
                                <div className="footer-legal">
                                    {company.chamber && <span>KvK: {company.chamber}</span>}
                                    {company.chamber && company.vat && <span className="sep">|</span>}
                                    {company.vat && <span>BTW: {company.vat}</span>}
                                </div>
                            </div>
                            {(quote.footer?.copyright || company.footer) && (
                                <p className="footer-copyright">{quote.footer?.copyright || company.footer}</p>
                            )}
                        </footer>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default QuoteRenderer;
