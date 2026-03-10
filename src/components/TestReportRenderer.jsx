import React, { useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Clock, ChevronDown, ChevronRight, Bug, Shield, Zap, Eye } from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';

/**
 * TestReportRenderer — Renders structured test reports for QA/testing agents
 * Triggered by ```json-test-report code blocks in MarkdownRenderer
 * 
 * Expected JSON shape:
 * {
 *   title: "Test Report Title",
 *   url: "https://tested-site.com",
 *   timestamp: "2024-01-15T10:30:00Z",
 *   duration: "2m 34s",
 *   summary: { passed: 5, failed: 2, skipped: 1, warnings: 3 },
 *   tests: [
 *     {
 *       name: "Login form validation",
 *       status: "passed" | "failed" | "skipped" | "warning",
 *       duration: "1.2s",
 *       category: "functionality" | "ui" | "performance" | "accessibility" | "security",
 *       description: "Tested login form with valid/invalid inputs",
 *       steps: ["Navigated to /login", "Entered valid email", ...],
 *       error: "Expected submit button to be enabled",
 *       screenshot: "data:image/png;base64,...",
 *       severity: "critical" | "major" | "minor" | "cosmetic"
 *     }
 *   ],
 *   notes: "Overall the site works well but...",
 *   recommendations: ["Fix the broken login flow", "Add ARIA labels"]
 * }
 */
const TestReportRenderer = ({ data }) => {
    const [expandedTests, setExpandedTests] = useState(new Set());
    const [filter, setFilter] = useState('all'); // all, passed, failed, warning, skipped

    if (!data) return null;

    const tests = data.tests || [];
    const summary = data.summary || {
        passed: tests.filter(t => t.status === 'passed').length,
        failed: tests.filter(t => t.status === 'failed').length,
        skipped: tests.filter(t => t.status === 'skipped').length,
        warnings: tests.filter(t => t.status === 'warning').length,
    };
    const total = (summary.passed || 0) + (summary.failed || 0) + (summary.skipped || 0) + (summary.warnings || 0);
    const passRate = total > 0 ? Math.round(((summary.passed || 0) / total) * 100) : 0;

    const toggleTest = (index) => {
        setExpandedTests(prev => {
            const next = new Set(prev);
            if (next.has(index)) next.delete(index);
            else next.add(index);
            return next;
        });
    };

    const filteredTests = filter === 'all'
        ? tests
        : tests.filter(t => t.status === filter);

    const statusConfig = {
        passed: { color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', icon: <CheckCircle className="w-4 h-4" />, label: 'Passed' },
        failed: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)', icon: <XCircle className="w-4 h-4" />, label: 'Failed' },
        warning: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', icon: <AlertTriangle className="w-4 h-4" />, label: 'Warning' },
        skipped: { color: '#6b7280', bg: 'rgba(107, 114, 128, 0.12)', icon: <Clock className="w-4 h-4" />, label: 'Skipped' },
    };

    const categoryConfig = {
        functionality: { icon: <Zap className="w-3.5 h-3.5" />, color: '#818cf8' },
        ui: { icon: <Eye className="w-3.5 h-3.5" />, color: '#38bdf8' },
        performance: { icon: <Clock className="w-3.5 h-3.5" />, color: '#fb923c' },
        accessibility: { icon: <Shield className="w-3.5 h-3.5" />, color: '#a78bfa' },
        security: { icon: <Bug className="w-3.5 h-3.5" />, color: '#f472b6' },
    };

    const severityColors = {
        critical: '#ef4444',
        major: '#f97316',
        minor: '#eab308',
        cosmetic: '#6b7280',
    };

    return (
        <div style={{
            width: '100%',
            maxWidth: '100%',
            overflow: 'hidden',
            whiteSpace: 'normal',
            fontFamily: 'var(--font-family, sans-serif)',
            margin: '0.5rem 0',
            borderRadius: '1rem',
            background: 'var(--bg-primary, #0a0a1a)',
            border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
            boxSizing: 'border-box',
        }}>
            {/* ── Header ── */}
            <div style={{
                padding: '1.5rem 1.5rem 1rem',
                borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
                background: passRate >= 80
                    ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, transparent 50%)'
                    : passRate >= 50
                        ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, transparent 50%)'
                        : 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, transparent 50%)',
                borderRadius: '1rem 1rem 0 0',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '1.25rem' }}>🧪</span>
                    <h2 style={{
                        fontSize: '1.25rem',
                        fontWeight: '700',
                        color: 'var(--text-primary, #fff)',
                        margin: 0,
                    }}>
                        {data.title || 'Test Report'}
                    </h2>
                </div>
                <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '1rem',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted, #888)',
                    marginTop: '0.5rem',
                }}>
                    {data.url && <span>🌐 {data.url}</span>}
                    {data.timestamp && <span>📅 {new Date(data.timestamp).toLocaleString()}</span>}
                    {data.duration && <span>⏱ {data.duration}</span>}
                </div>
            </div>

            {/* ── Summary Stats ── */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: '0.5rem',
                padding: '1rem 1.5rem',
                borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
            }}>
                {/* Pass rate */}
                <div style={{
                    textAlign: 'center',
                    padding: '0.75rem 0.5rem',
                    borderRadius: '0.75rem',
                    background: 'var(--bg-tertiary, rgba(255,255,255,0.03))',
                }}>
                    <div style={{
                        fontSize: '1.5rem',
                        fontWeight: '800',
                        color: passRate >= 80 ? '#10b981' : passRate >= 50 ? '#f59e0b' : '#ef4444',
                        lineHeight: 1.2,
                    }}>
                        {passRate}%
                    </div>
                    <div style={{
                        fontSize: '0.65rem',
                        color: 'var(--text-muted, #888)',
                        marginTop: '0.25rem',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                    }}>
                        Pass Rate
                    </div>
                </div>
                {/* Individual counts */}
                {[
                    { key: 'passed', val: summary.passed || 0 },
                    { key: 'failed', val: summary.failed || 0 },
                    { key: 'warning', val: summary.warnings || 0 },
                    { key: 'skipped', val: summary.skipped || 0 },
                ].map(({ key, val }) => {
                    const sc = statusConfig[key];
                    return (
                        <button
                            key={key}
                            onClick={() => setFilter(filter === key ? 'all' : key)}
                            style={{
                                textAlign: 'center',
                                padding: '0.75rem 0.5rem',
                                borderRadius: '0.75rem',
                                background: filter === key ? sc.bg : 'var(--bg-tertiary, rgba(255,255,255,0.03))',
                                border: filter === key ? `1px solid ${sc.color}40` : '1px solid transparent',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                            }}
                        >
                            <div style={{
                                fontSize: '1.5rem',
                                fontWeight: '800',
                                color: sc.color,
                                lineHeight: 1.2,
                            }}>
                                {val}
                            </div>
                            <div style={{
                                fontSize: '0.65rem',
                                color: 'var(--text-muted, #888)',
                                marginTop: '0.25rem',
                                fontWeight: '600',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                            }}>
                                {sc.label}
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* ── Test Cases ── */}
            <div style={{ padding: '0.75rem 1.5rem 1rem' }}>
                {filteredTests.length === 0 && (
                    <div style={{
                        textAlign: 'center',
                        padding: '2rem',
                        color: 'var(--text-muted, #888)',
                        fontSize: '0.85rem',
                    }}>
                        No {filter !== 'all' ? filter : ''} tests to display
                    </div>
                )}
                {filteredTests.map((test, i) => {
                    const sc = statusConfig[test.status] || statusConfig.skipped;
                    const cat = categoryConfig[test.category];
                    const isExpanded = expandedTests.has(i);
                    const sev = test.severity ? severityColors[test.severity] : null;

                    return (
                        <div key={i} style={{
                            marginBottom: '0.5rem',
                            borderRadius: '0.75rem',
                            border: `1px solid ${isExpanded ? sc.color + '30' : 'var(--border-subtle, rgba(255,255,255,0.06))'}`,
                            overflow: 'hidden',
                            transition: 'all 0.15s ease',
                        }}>
                            {/* Test header row */}
                            <button
                                onClick={() => toggleTest(i)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    width: '100%',
                                    padding: '0.75rem 1rem',
                                    background: isExpanded ? sc.bg : 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    transition: 'background 0.15s ease',
                                }}
                            >
                                {/* Expand chevron */}
                                <span style={{ color: 'var(--text-muted, #888)', flexShrink: 0 }}>
                                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                </span>
                                {/* Status icon */}
                                <span style={{ color: sc.color, flexShrink: 0 }}>{sc.icon}</span>
                                {/* Test name */}
                                <span style={{
                                    flex: 1,
                                    fontSize: '0.85rem',
                                    fontWeight: '500',
                                    color: 'var(--text-primary, #fff)',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}>
                                    {test.name}
                                </span>
                                {/* Category badge */}
                                {cat && (
                                    <span style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.25rem',
                                        fontSize: '0.65rem',
                                        fontWeight: '600',
                                        color: cat.color,
                                        background: cat.color + '18',
                                        padding: '0.2rem 0.5rem',
                                        borderRadius: '999px',
                                        flexShrink: 0,
                                    }}>
                                        {cat.icon} {test.category}
                                    </span>
                                )}
                                {/* Severity badge */}
                                {sev && (
                                    <span style={{
                                        fontSize: '0.6rem',
                                        fontWeight: '700',
                                        color: sev,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px',
                                        flexShrink: 0,
                                    }}>
                                        {test.severity}
                                    </span>
                                )}
                                {/* Duration */}
                                {test.duration && (
                                    <span style={{
                                        fontSize: '0.7rem',
                                        color: 'var(--text-muted, #666)',
                                        flexShrink: 0,
                                    }}>
                                        {test.duration}
                                    </span>
                                )}
                            </button>

                            {/* Expanded details */}
                            {isExpanded && (
                                <div style={{
                                    padding: '0.75rem 1rem 1rem',
                                    paddingLeft: '3rem',
                                    background: sc.bg,
                                    borderTop: `1px solid ${sc.color}15`,
                                }}>
                                    {/* Description */}
                                    {test.description && (
                                        <div style={{
                                            fontSize: '0.8rem',
                                            color: 'var(--text-secondary, #ccc)',
                                            marginBottom: '0.75rem',
                                            lineHeight: 1.5,
                                        }}>
                                            {test.description}
                                        </div>
                                    )}

                                    {/* Steps */}
                                    {test.steps && test.steps.length > 0 && (
                                        <div style={{ marginBottom: '0.75rem' }}>
                                            <div style={{
                                                fontSize: '0.7rem',
                                                fontWeight: '600',
                                                color: 'var(--text-muted, #888)',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.5px',
                                                marginBottom: '0.4rem',
                                            }}>
                                                Steps
                                            </div>
                                            <ol style={{
                                                margin: 0,
                                                paddingLeft: '1.25rem',
                                                fontSize: '0.78rem',
                                                color: 'var(--text-secondary, #ccc)',
                                                lineHeight: 1.8,
                                            }}>
                                                {test.steps.map((step, si) => (
                                                    <li key={si}>{typeof step === 'string' ? step : (step?.description || step?.action || JSON.stringify(step))}</li>
                                                ))}
                                            </ol>
                                        </div>
                                    )}

                                    {/* Error */}
                                    {test.error && (
                                        <div style={{
                                            padding: '0.6rem 0.75rem',
                                            borderRadius: '0.5rem',
                                            background: 'rgba(239, 68, 68, 0.1)',
                                            border: '1px solid rgba(239, 68, 68, 0.2)',
                                            marginBottom: '0.75rem',
                                        }}>
                                            <div style={{
                                                fontSize: '0.7rem',
                                                fontWeight: '600',
                                                color: '#ef4444',
                                                marginBottom: '0.25rem',
                                            }}>
                                                ❌ Error
                                            </div>
                                            <div style={{
                                                fontSize: '0.78rem',
                                                color: '#fca5a5',
                                                fontFamily: 'monospace',
                                                whiteSpace: 'pre-wrap',
                                                wordBreak: 'break-word',
                                            }}>
                                                {test.error}
                                            </div>
                                        </div>
                                    )}

                                    {/* Screenshot */}
                                    {test.screenshot && (
                                        <div style={{ marginBottom: '0.5rem' }}>
                                            <img
                                                src={test.screenshot}
                                                alt={`Screenshot: ${test.name}`}
                                                style={{
                                                    maxWidth: '100%',
                                                    maxHeight: '300px',
                                                    borderRadius: '0.5rem',
                                                    border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
                                                    objectFit: 'contain',
                                                }}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* ── Recommendations ── */}
            {data.recommendations && data.recommendations.length > 0 && (
                <div style={{
                    padding: '1rem 1.5rem',
                    borderTop: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
                }}>
                    <div style={{
                        fontSize: '0.8rem',
                        fontWeight: '700',
                        color: 'var(--text-primary, #fff)',
                        marginBottom: '0.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                    }}>
                        💡 Recommendations
                    </div>
                    <ul style={{
                        margin: 0,
                        paddingLeft: '1.25rem',
                        fontSize: '0.8rem',
                        color: 'var(--text-secondary, #ccc)',
                        lineHeight: 1.8,
                    }}>
                        {data.recommendations.map((rec, i) => (
                            <li key={i}>{typeof rec === 'string' ? rec : (rec?.description || rec?.action || JSON.stringify(rec))}</li>
                        ))}
                    </ul>
                </div>
            )}

            {/* ── Notes ── */}
            {data.notes && (
                <div style={{
                    padding: '1rem 1.5rem',
                    borderTop: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
                    fontSize: '0.8rem',
                    color: 'var(--text-secondary, #ccc)',
                    lineHeight: 1.6,
                }}>
                    <MarkdownRenderer content={data.notes} />
                </div>
            )}
        </div>
    );
};

export default TestReportRenderer;
