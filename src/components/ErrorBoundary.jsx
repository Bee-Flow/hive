import React from 'react';
import { reportClientError } from '../utils/clientErrorReporter';

/**
 * Two boundaries in one file:
 *
 *   <ErrorBoundary> — the "something went wrong" app-level catcher.
 *     Full-height friendly fallback with "reload" and error details.
 *     Use at the root (wraps <App />).
 *
 *   <MessageErrorBoundary> — the "one message failed" catcher.
 *     Tiny inline fallback so ONE bad message doesn't blank the conversation.
 *     Use around <MessageItem />.
 *
 * Both catch render errors and lifecycle throws. They do NOT catch errors in
 * event handlers, async code, or setTimeout — those need their own try/catch.
 *
 * componentDidCatch fires once per caught error. We hand off to
 * `reportClientError`, which redacts tokens/keys from the payload before
 * POSTing and queues to IndexedDB if the network is down (drained on next
 * app mount via `drainErrorQueue`).
 */

export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null, info: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        this.setState({ info });
        reportClientError(this.props.label || 'root', error, info);
    }

    handleReload = () => {
        try { window.location.reload(); } catch (_) { /* ignore */ }
    };

    handleReset = () => {
        this.setState({ error: null, info: null });
    };

    render() {
        if (!this.state.error) return this.props.children;

        const { error } = this.state;
        return (
            <div
                role="alert"
                style={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '24px',
                    background: 'var(--bg-primary, #fff)',
                    color: 'var(--text-primary, #111)',
                }}
            >
                <div style={{ maxWidth: '540px', width: '100%' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>⚠️</div>
                    <h1 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>
                        Something went wrong
                    </h1>
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary, #555)', marginBottom: '16px' }}>
                        The app hit an unexpected error and couldn't continue. Reloading usually fixes it.
                    </p>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                        <button
                            onClick={this.handleReload}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '8px',
                                background: 'var(--text-primary, #111)',
                                color: 'var(--bg-primary, #fff)',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: 500,
                            }}
                        >
                            Reload page
                        </button>
                        <button
                            onClick={this.handleReset}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '8px',
                                background: 'transparent',
                                color: 'var(--text-primary, #111)',
                                border: '1px solid var(--border-default, #ccc)',
                                cursor: 'pointer',
                                fontSize: '14px',
                            }}
                        >
                            Try again
                        </button>
                    </div>
                    <details style={{ fontSize: '12px', color: 'var(--text-tertiary, #888)' }}>
                        <summary style={{ cursor: 'pointer' }}>Error details</summary>
                        <pre style={{
                            marginTop: '8px', padding: '8px',
                            background: 'var(--bg-tertiary, #f4f4f4)', borderRadius: '4px',
                            overflow: 'auto', maxHeight: '240px', fontSize: '11px',
                        }}>
                            {String(error?.message || error)}
                            {error?.stack ? `\n\n${error.stack}` : ''}
                        </pre>
                    </details>
                </div>
            </div>
        );
    }
}

/**
 * Lightweight per-message boundary. Swallows a render error for a single
 * message and renders a small placeholder so the rest of the conversation
 * keeps working. Offers a "copy raw" so the user can send us the JSON blob
 * that broke.
 */
export class MessageErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        reportClientError('message', error, info);
    }

    handleCopy = () => {
        try {
            const raw = JSON.stringify(this.props.msg || {}, null, 2);
            navigator.clipboard?.writeText(raw);
        } catch (_) { /* ignore */ }
    };

    render() {
        if (!this.state.error) return this.props.children;
        return (
            <div
                role="alert"
                className="my-2 px-3 py-2 rounded-lg text-sm"
                style={{
                    background: 'var(--bg-tertiary, rgba(255,0,0,0.05))',
                    border: '1px solid var(--border-default, rgba(255,0,0,0.15))',
                    color: 'var(--text-secondary, #555)',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>⚠️</span>
                    <span>This message failed to render.</span>
                    <button
                        onClick={this.handleCopy}
                        style={{
                            marginLeft: 'auto',
                            fontSize: '11px',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: 'transparent',
                            border: '1px solid var(--border-default, #ccc)',
                            cursor: 'pointer',
                            color: 'inherit',
                        }}
                        title="Copy raw message JSON"
                    >
                        Copy raw
                    </button>
                </div>
            </div>
        );
    }
}

export default ErrorBoundary;
