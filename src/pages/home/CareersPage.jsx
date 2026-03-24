import React from 'react';
import HomeLayout from './HomeLayout';

export default function CareersPage({ onNavigate, onLoginClick }) {
  return (
    <HomeLayout onNavigate={onNavigate} onLoginClick={onLoginClick}>
      <div className="hp-page-hero">
        <div className="hp-container">
          <span className="hp-label">Vacatures</span>
          <h1 className="hp-h1">Word lid van ons team</h1>
          <p className="hp-body--sm">
            Wij bouwen aan de toekomst van AI-gestuurde workflow automatisering. Kom en help ons deze vorm te geven.
          </p>
        </div>
      </div>

      <section className="hp-section">
        <div className="hp-container" style={{ maxWidth: 820 }}>
          {/* Vacancy card */}
          <div className="hp-reveal" style={{
            background: '#fff',
            border: '1px solid rgba(0,0,0,.07)',
            borderRadius: 18,
            padding: '40px 44px',
            marginBottom: 32,
            boxShadow: '0 2px 12px rgba(0,0,0,.04)',
          }}>
            {/* Header */}
            <div style={{ marginBottom: 32 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                <span style={{
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  color: '#fff',
                  fontSize: '.7rem',
                  fontWeight: 700,
                  padding: '4px 12px',
                  borderRadius: 20,
                  textTransform: 'uppercase',
                  letterSpacing: '.5px',
                }}>
                  Open Positie
                </span>
                <span style={{ fontSize: '.8rem', color: '#94a3b8' }}>
                  Geplaatst 16 maart, 2026
                </span>
              </div>
              <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', marginBottom: 8, lineHeight: 1.3 }}>
                Senior Software Ontwikkelaar – AI Project
              </h2>
              <p style={{ fontSize: '.95rem', color: '#64748b', lineHeight: 1.7 }}>
                Fulltime · Hybride · Nederland
              </p>
            </div>

            {/* Over ons */}
            <div style={{ marginBottom: 32 }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>Over ons</h3>
              <p style={{ fontSize: '.92rem', color: '#334155', lineHeight: 1.8 }}>
                Wij zijn op zoek naar een gedreven Senior Software Ontwikkelaar voor de ontwikkeling van geavanceerde
                AI-oplossingen. Bij Bee Flow ga je helpen de AI revolutie vorm te geven door het bouwen van een concrete
                AI tool die bedrijven helpt echt het verschil te maken. Je wordt onderdeel van een enthousiast jong team
                bij een startup dat werkt aan technische uitdagingen op het hoogste niveau.
              </p>
            </div>

            {/* Wat ga je doen */}
            <div style={{ marginBottom: 32 }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>Wat ga je doen?</h3>
              <ul style={{ fontSize: '.92rem', color: '#334155', lineHeight: 2, paddingLeft: 20, listStyle: 'none' }}>
                {[
                  'Ontwikkelen en implementeren van AI-gestuurde applicaties en systemen',
                  'Werken met Google Antigravity als primair ontwikkelplatform voor agentic AI-ontwikkeling',
                  'Ontwerpen en bouwen van machine learning pipelines en modellen',
                  'Integreren van Large Language Models (LLM\'s) in productieomgevingen',
                  'Ontwikkelen van autonome AI-agents die complexe engineeringtaken uitvoeren',
                  'Bijdragen aan onderzoek en ontwikkeling van nieuwe AI-gedreven functionaliteiten',
                  'Schrijven van hoogwaardige, geteste en gedocumenteerde code in Python, TypeScript en JavaScript',
                ].map((item, i) => (
                  <li key={i} style={{ position: 'relative', paddingLeft: 20 }}>
                    <span style={{ position: 'absolute', left: 0, color: '#d97706', fontWeight: 700 }}>→</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Wie zoeken wij */}
            <div style={{ marginBottom: 32 }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>Wie zoeken wij?</h3>
              <ul style={{ fontSize: '.92rem', color: '#334155', lineHeight: 2, paddingLeft: 20, listStyle: 'none' }}>
                {[
                  'HBO/WO diploma in Informatica, Kunstmatige Intelligentie, Data Science of vergelijkbaar',
                  'Minimaal 3 jaar ervaring met Python-ontwikkeling',
                  'Ervaring met TypeScript en JavaScript',
                  'Kennis van Large Language Models en Prompt Engineering',
                  'Ervaring met Google Antigravity of vergelijkbare AI-aangedreven ontwikkelplatforms is een pre',
                  'Bekendheid met cloudplatformen (AWS, Google Cloud, of Azure)',
                  'Kennis van softwarearchitectuur en design patterns',
                  'Analytisch vermogen en probleemoplossend denkvermogen',
                  'Goede communicatieve vaardigheden in Nederlands en Engels',
                ].map((item, i) => (
                  <li key={i} style={{ position: 'relative', paddingLeft: 20 }}>
                    <span style={{ position: 'absolute', left: 0, color: '#d97706', fontWeight: 700 }}>→</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Technische vereisten */}
            <div style={{ marginBottom: 32 }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>Technische vereisten</h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: 10,
              }}>
                {[
                  'Python 3.9+ (primaire programmeertaal)',
                  'TypeScript en JavaScript',
                  'Ervaring met Git als versiebeheersysteem',
                  'PostgreSQL 15, Redis 7',
                  'Opslag: RustFS (S3-compatibel)',
                  'Begrip van RESTful API\'s en microservices architectuur',
                ].map((item, i) => (
                  <div key={i} style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 10,
                    padding: '10px 14px',
                    fontSize: '.85rem',
                    color: '#334155',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}>
                    <span style={{ color: '#d97706', fontSize: '1rem' }}>⚙</span>
                    {item}
                  </div>
                ))}
              </div>
            </div>

            {/* Wat bieden wij */}
            <div style={{ marginBottom: 32 }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>Wat bieden wij?</h3>
              <ul style={{ fontSize: '.92rem', color: '#334155', lineHeight: 2, paddingLeft: 20, listStyle: 'none' }}>
                {[
                  'Innovatief R&D-project met focus op baanbrekende AI-technologie',
                  'Modern tech stack met Google Antigravity en state-of-the-art AI-tools',
                  'Competitief salaris afhankelijk van ervaring',
                  'Flexibele werktijden en mogelijkheid tot hybride werken',
                  'Uitgebreide opleidingsmogelijkheden en certificeringstrajecten',
                  'Inspirerende werkomgeving met ervaren collega\'s en korte lijnen',
                ].map((item, i) => (
                  <li key={i} style={{ position: 'relative', paddingLeft: 20 }}>
                    <span style={{ position: 'absolute', left: 0, color: '#10b981', fontWeight: 700 }}>✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Interesse? CTA */}
            <div style={{
              background: 'linear-gradient(135deg, #fffbeb, #fef3c7)',
              border: '1px solid #fde68a',
              borderRadius: 14,
              padding: '28px 32px',
              textAlign: 'center',
            }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#92400e', marginBottom: 8 }}>
                Interesse?
              </h3>
              <p style={{ fontSize: '.92rem', color: '#92400e', lineHeight: 1.7, marginBottom: 16, opacity: 0.85 }}>
                Ben jij de ontwikkelaar die wij zoeken en wil je werken aan innovatieve AI-projecten?
                Stuur dan je CV en motivatiebrief naar onderstaand e-mailadres.
              </p>
              <a
                href="mailto:info@beeflow.nl"
                style={{
                  display: 'inline-block',
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  color: '#fff',
                  padding: '12px 32px',
                  borderRadius: 12,
                  fontWeight: 700,
                  fontSize: '.95rem',
                  textDecoration: 'none',
                  boxShadow: '0 4px 14px rgba(245,158,11,.3)',
                  transition: 'transform .15s, box-shadow .15s',
                }}
                onMouseEnter={e => { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 6px 20px rgba(245,158,11,.4)'; }}
                onMouseLeave={e => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = '0 4px 14px rgba(245,158,11,.3)'; }}
              >
                📧 info@beeflow.nl
              </a>
              <p style={{ fontSize: '.78rem', color: '#92400e', marginTop: 16, opacity: 0.6 }}>
                Acquisitie naar aanleiding van deze vacature wordt niet op prijs gesteld.
              </p>
            </div>
          </div>
        </div>
      </section>
    </HomeLayout>
  );
}
