import React, { useMemo, useState } from 'react';

/**
 * PageRenderer - Renders a page/dashboard from JSON definition
 * Supports layout, content, interactive, and data elements
 */
const PageRenderer = ({ code, onAction }) => {
    const [overlay, setOverlay] = useState(null); // { title, content, url }

    // Parse the page definition
    const pageDef = useMemo(() => {
        try {
            return typeof code === 'string' ? JSON.parse(code) : code;
        } catch {
            return null;
        }
    }, [code]);

    if (!pageDef) {
        return (
            <div className="my-4 p-4 rounded-xl border" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-tertiary)' }}>
                <div className="text-red-400 text-sm">Invalid page definition. Expected JSON format.</div>
                <pre className="mt-2 text-xs overflow-auto" style={{ color: 'var(--text-muted)' }}>{code}</pre>
            </div>
        );
    }

    // Handle button click - show overlay
    const handleButtonClick = (element) => {
        onAction && onAction({ type: 'button', action: element.action, data: element.data });

        // Show overlay with button info
        setOverlay({
            title: element.text || element.label || 'Info',
            content: element.overlay || element.description || element.content || `Action: ${element.action || 'click'}`,
            url: element.url || element.href,
            data: element.data
        });
    };

    // Recursive element renderer
    const renderElement = (element, index = 0) => {
        if (!element || typeof element !== 'object') return null;

        const key = element.id || `el-${index}`;
        const { type, children } = element;

        // Render children recursively
        const renderChildren = () => {
            if (!children) return null;
            if (Array.isArray(children)) {
                return children.map((child, i) => renderElement(child, i));
            }
            return children;
        };

        switch (type) {
            // ============ LAYOUT ============

            case 'page':
                return (
                    <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {element.title && (
                            <h1 style={{
                                fontSize: '1.5rem',
                                fontWeight: '700',
                                color: 'var(--text-primary)',
                                paddingBottom: '0.75rem',
                                borderBottom: '2px solid transparent',
                                borderImage: 'linear-gradient(90deg, #8b5cf6, #6366f1, transparent) 1',
                                margin: 0
                            }}>
                                {element.title}
                            </h1>
                        )}
                        {renderChildren()}
                    </div>
                );

            case 'grid':
                return (
                    <div
                        key={key}
                        style={{
                            display: 'grid',
                            gridTemplateColumns: `repeat(${element.columns || 2}, minmax(0, 1fr))`,
                            gap: element.gap || 16
                        }}
                    >
                        {renderChildren()}
                    </div>
                );

            case 'row':
            case 'columns':
                return (
                    <div
                        key={key}
                        style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: element.gap || 16,
                            alignItems: element.align || 'stretch',
                            justifyContent: element.justify || 'flex-start'
                        }}
                    >
                        {renderChildren()}
                    </div>
                );

            case 'section':
                return (
                    <div key={key} style={{ marginBottom: '1.5rem', overflow: 'hidden', maxWidth: '100%' }}>
                        {element.title && (
                            <h2 style={{
                                fontSize: '1.125rem',
                                fontWeight: '600',
                                marginBottom: '1rem',
                                paddingBottom: '0.5rem',
                                color: 'var(--text-primary)',
                                borderBottom: '1px solid var(--border-subtle)'
                            }}>
                                {element.title}
                            </h2>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflow: 'hidden' }}>{renderChildren()}</div>
                    </div>
                );

            case 'card':
                return (
                    <div
                        key={key}
                        style={{
                            background: 'var(--bg-secondary)',
                            borderRadius: '1rem',
                            padding: '1.25rem',
                            border: '1px solid var(--border-default)',
                            boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
                            transition: 'all 0.2s ease',
                            position: 'relative',
                            overflow: 'hidden',
                            minWidth: 0
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
                            e.currentTarget.style.transform = 'translateY(-2px)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.06)';
                            e.currentTarget.style.transform = 'translateY(0)';
                        }}
                    >
                        {/* Accent gradient line at top */}
                        <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            height: '3px',
                            background: 'linear-gradient(90deg, #8b5cf6, #6366f1, #3b82f6)'
                        }} />
                        {element.title && (
                            <h3 style={{
                                fontSize: '1rem',
                                fontWeight: '600',
                                color: 'var(--text-primary)',
                                marginBottom: '0.75rem'
                            }}>
                                {element.title}
                            </h3>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {renderChildren()}
                        </div>
                    </div>
                );

            // ============ CONTENT ============

            case 'heading':
                const HeadingTag = `h${element.level || 2}`;
                const headingSizes = {
                    1: { size: '1.75rem', weight: '700' },
                    2: { size: '1.375rem', weight: '600' },
                    3: { size: '1.125rem', weight: '600' },
                    4: { size: '1rem', weight: '600' },
                    5: { size: '0.875rem', weight: '500' },
                    6: { size: '0.75rem', weight: '500' }
                };
                const hStyle = headingSizes[element.level || 2];
                return (
                    <HeadingTag
                        key={key}
                        style={{
                            color: 'var(--text-primary)',
                            fontSize: hStyle.size,
                            fontWeight: hStyle.weight,
                            lineHeight: '1.4'
                        }}
                    >
                        {element.text}
                    </HeadingTag>
                );

            case 'text':
            case 'paragraph':
                return (
                    <p key={key} style={{
                        color: 'var(--text-secondary)',
                        fontSize: '0.9rem',
                        lineHeight: '1.7',
                        wordBreak: 'break-word',
                        overflowWrap: 'anywhere',
                        margin: 0
                    }}>
                        {element.text || element.content}
                    </p>
                );

            case 'image':
                return (
                    <img
                        key={key}
                        src={element.src}
                        alt={element.alt || ''}
                        style={{
                            width: '100%',
                            maxWidth: '100%',
                            height: element.height || 'auto',
                            objectFit: element.fit || 'cover',
                            borderRadius: '0.75rem',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                            display: 'block'
                        }}
                    />
                );

            case 'list':
                const ListTag = element.ordered ? 'ol' : 'ul';
                return (
                    <ListTag
                        key={key}
                        style={{
                            color: 'var(--text-secondary)',
                            fontSize: '0.9rem',
                            paddingLeft: '1.5rem',
                            listStyleType: element.ordered ? 'decimal' : 'disc'
                        }}
                    >
                        {(element.items || []).map((item, i) => (
                            <li key={i} style={{ marginBottom: '0.5rem' }}>
                                {typeof item === 'object' ? renderElement(item, i) : item}
                            </li>
                        ))}
                    </ListTag>
                );

            case 'divider':
                return (
                    <hr
                        key={key}
                        style={{
                            border: 'none',
                            borderTop: '1px solid var(--border-subtle)',
                            margin: '1.5rem 0'
                        }}
                    />
                );

            // ============ INTERACTIVE ============

            case 'button':
                const buttonColors = {
                    primary: { bg: 'linear-gradient(135deg, #8b5cf6, #6366f1)', hover: '#7c3aed' },
                    secondary: { bg: 'var(--bg-tertiary)', hover: 'var(--bg-secondary)' },
                    success: { bg: 'linear-gradient(135deg, #10b981, #059669)', hover: '#059669' },
                    danger: { bg: 'linear-gradient(135deg, #ef4444, #dc2626)', hover: '#dc2626' },
                    warning: { bg: 'linear-gradient(135deg, #f59e0b, #d97706)', hover: '#d97706' }
                };
                const btnStyle = buttonColors[element.variant] || buttonColors.primary;
                return (
                    <button
                        key={key}
                        onClick={() => handleButtonClick(element)}
                        style={{
                            background: btnStyle.bg,
                            color: element.variant === 'secondary' ? 'var(--text-primary)' : 'white',
                            padding: '0.625rem 1.25rem',
                            borderRadius: '0.625rem',
                            fontWeight: '500',
                            fontSize: '0.875rem',
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                        }}
                        onMouseEnter={(e) => e.target.style.transform = 'translateY(-1px)'}
                        onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
                    >
                        {element.text || element.label}
                    </button>
                );

            case 'tabs':
                const tabs = element.tabs || [];
                return (
                    <div key={key}>
                        <div style={{
                            display: 'flex',
                            gap: '0.5rem',
                            marginBottom: '1rem',
                            borderBottom: '2px solid var(--border-subtle)',
                            paddingBottom: '0.5rem'
                        }}>
                            {tabs.map((tab, i) => (
                                <button
                                    key={i}
                                    style={{
                                        padding: '0.5rem 1rem',
                                        fontSize: '0.875rem',
                                        fontWeight: '500',
                                        color: i === 0 ? 'var(--text-primary)' : 'var(--text-muted)',
                                        background: i === 0 ? 'var(--bg-tertiary)' : 'transparent',
                                        border: 'none',
                                        borderRadius: '0.5rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                        <div>{tabs[0]?.children && tabs[0].children.map((c, j) => renderElement(c, j))}</div>
                    </div>
                );

            case 'accordion':
                return (
                    <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {(element.items || []).map((item, i) => (
                            <details
                                key={i}
                                style={{
                                    background: 'var(--bg-tertiary)',
                                    borderRadius: '0.75rem',
                                    overflow: 'hidden'
                                }}
                            >
                                <summary style={{
                                    padding: '0.875rem 1rem',
                                    cursor: 'pointer',
                                    fontWeight: '500',
                                    color: 'var(--text-primary)'
                                }}>
                                    {item.title}
                                </summary>
                                <div style={{
                                    padding: '0 1rem 1rem',
                                    fontSize: '0.9rem',
                                    color: 'var(--text-secondary)'
                                }}>
                                    {item.content || (item.children && item.children.map((c, j) => renderElement(c, j)))}
                                </div>
                            </details>
                        ))}
                    </div>
                );

            // ============ DATA ============

            case 'table':
                return (
                    <div key={key} style={{
                        overflowX: 'auto',
                        borderRadius: '0.75rem',
                        border: '1px solid var(--border-default)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                    }}>
                        <table style={{ width: '100%', fontSize: '0.875rem', borderCollapse: 'collapse' }}>
                            <thead style={{ background: 'var(--bg-tertiary)' }}>
                                <tr>
                                    {(element.columns || []).map((col, i) => (
                                        <th key={i} style={{
                                            padding: '0.875rem 1rem',
                                            textAlign: 'left',
                                            fontWeight: '600',
                                            color: 'var(--text-primary)'
                                        }}>
                                            {typeof col === 'object' ? col.label : col}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {(element.rows || []).map((row, i) => (
                                    <tr key={i} style={{
                                        borderTop: '1px solid var(--border-subtle)',
                                        transition: 'background 0.15s'
                                    }}>
                                        {(Array.isArray(row) ? row : Object.values(row)).map((cell, j) => (
                                            <td key={j} style={{
                                                padding: '0.875rem 1rem',
                                                color: 'var(--text-secondary)'
                                            }}>
                                                {cell}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );

            case 'stat':
                const statColors = {
                    blue: { bg: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' },
                    green: { bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981' },
                    red: { bg: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' },
                    yellow: { bg: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' },
                    purple: { bg: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' },
                    default: { bg: 'var(--bg-secondary)', color: 'var(--text-primary)' }
                };
                const sColor = statColors[element.color] || statColors.default;
                return (
                    <div
                        key={key}
                        style={{
                            background: sColor.bg,
                            borderRadius: '1rem',
                            padding: '1.25rem',
                            textAlign: 'center',
                            border: '1px solid var(--border-default)'
                        }}
                    >
                        <div style={{
                            fontSize: '2rem',
                            fontWeight: '700',
                            color: sColor.color,
                            marginBottom: '0.25rem'
                        }}>
                            {element.value}
                        </div>
                        <div style={{
                            fontSize: '0.875rem',
                            color: 'var(--text-muted)'
                        }}>
                            {element.label}
                        </div>
                        {element.change && (
                            <div style={{
                                fontSize: '0.75rem',
                                marginTop: '0.5rem',
                                color: element.change > 0 ? '#10b981' : '#ef4444'
                            }}>
                                {element.change > 0 ? '↑' : '↓'} {Math.abs(element.change)}%
                            </div>
                        )}
                    </div>
                );

            case 'badge':
                const badgeColors = {
                    success: { bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981' },
                    warning: { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' },
                    error: { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' },
                    info: { bg: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' },
                    default: { bg: 'var(--bg-tertiary)', color: 'var(--text-muted)' }
                };
                const bStyle = badgeColors[element.variant] || badgeColors.default;
                return (
                    <span
                        key={key}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '0.25rem 0.75rem',
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                            fontWeight: '500',
                            background: bStyle.bg,
                            color: bStyle.color
                        }}
                    >
                        {element.text}
                    </span>
                );

            case 'chart':
                const maxValue = Math.max(...(element.data || []).map(d => d.value));
                return (
                    <div key={key}>
                        {element.title && (
                            <div style={{
                                fontSize: '0.9rem',
                                fontWeight: '600',
                                color: 'var(--text-primary)',
                                marginBottom: '1rem'
                            }}>
                                {element.title}
                            </div>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {(element.data || []).map((item, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{
                                        width: '5rem',
                                        fontSize: '0.8rem',
                                        color: 'var(--text-muted)',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        {item.label}
                                    </div>
                                    <div style={{
                                        flex: 1,
                                        height: '1.5rem',
                                        borderRadius: '9999px',
                                        background: 'var(--bg-tertiary)',
                                        overflow: 'hidden'
                                    }}>
                                        <div
                                            style={{
                                                height: '100%',
                                                borderRadius: '9999px',
                                                width: `${(item.value / maxValue) * 100}%`,
                                                background: item.color || 'linear-gradient(90deg, #8b5cf6, #6366f1)',
                                                transition: 'width 0.5s ease'
                                            }}
                                        />
                                    </div>
                                    <div style={{
                                        width: '3rem',
                                        fontSize: '0.8rem',
                                        textAlign: 'right',
                                        color: 'var(--text-secondary)',
                                        fontWeight: '500'
                                    }}>
                                        {item.value}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );

            default:
                if (element.text || element.content) {
                    return (
                        <div key={key} style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                            {element.text || element.content}
                        </div>
                    );
                }
                return null;
        }
    };

    return (
        <div style={{
            margin: '1rem 0',
            padding: '1.5rem',
            borderRadius: '1rem',
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-subtle)',
            overflow: 'hidden',
            maxWidth: '100%',
            boxSizing: 'border-box'
        }}>
            {renderElement(pageDef)}

            {/* Overlay Modal */}
            {overlay && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 9999,
                        backdropFilter: 'blur(4px)'
                    }}
                    onClick={() => setOverlay(null)}
                >
                    <div
                        style={{
                            background: 'var(--bg-primary)',
                            borderRadius: '1rem',
                            padding: '1.5rem',
                            maxWidth: '500px',
                            width: '90%',
                            maxHeight: '80vh',
                            overflow: 'auto',
                            boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
                            border: '1px solid var(--border-default)'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '1rem'
                        }}>
                            <h3 style={{
                                fontSize: '1.25rem',
                                fontWeight: '600',
                                color: 'var(--text-primary)'
                            }}>
                                {overlay.title}
                            </h3>
                            <button
                                onClick={() => setOverlay(null)}
                                style={{
                                    background: 'var(--bg-tertiary)',
                                    border: 'none',
                                    borderRadius: '0.5rem',
                                    padding: '0.5rem',
                                    cursor: 'pointer',
                                    color: 'var(--text-muted)'
                                }}
                            >
                                ✕
                            </button>
                        </div>

                        <div style={{
                            fontSize: '0.9rem',
                            color: 'var(--text-secondary)',
                            lineHeight: '1.7',
                            wordBreak: 'break-word'
                        }}>
                            {overlay.content}
                        </div>

                        {overlay.url && (
                            <a
                                href={overlay.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    display: 'inline-block',
                                    marginTop: '1rem',
                                    padding: '0.625rem 1.25rem',
                                    background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                                    color: 'white',
                                    borderRadius: '0.5rem',
                                    textDecoration: 'none',
                                    fontWeight: '500',
                                    fontSize: '0.875rem'
                                }}
                            >
                                Open Link →
                            </a>
                        )}

                        <button
                            onClick={() => setOverlay(null)}
                            style={{
                                display: 'block',
                                width: '100%',
                                marginTop: '1rem',
                                padding: '0.75rem',
                                background: 'var(--bg-tertiary)',
                                border: 'none',
                                borderRadius: '0.5rem',
                                cursor: 'pointer',
                                color: 'var(--text-primary)',
                                fontWeight: '500'
                            }}
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PageRenderer;
