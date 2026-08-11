// Masked secret input with a show/hide toggle — replaces the
//
//   <div className="relative flex-1">
//       <input type={showKey ? 'text' : 'password'} ... />
//       <button onClick={() => setShowKey(!showKey)}>👁️</button>
//   </div>
//
// block that was copy-pasted across the provider API-key cards and
// RerankerConfig. Visibility state is internal by default; pass `show` +
// `onToggleShow` to control it from the parent (e.g. to re-mask the field
// after a successful save, like ProviderApiKeyCard does).
//
// `onChange` receives the raw string value (not the event); `onEnter`
// (optional) runs on the Enter key for save-on-Enter cards.

import React, { useState } from 'react';

const SecretInput = ({ value, onChange, placeholder, onEnter, show, onToggleShow, className = 'relative flex-1' }) => {
    const [internalShow, setInternalShow] = useState(false);
    const isControlled = show !== undefined;
    const visible = isControlled ? show : internalShow;

    const toggleShow = () => {
        if (isControlled) onToggleShow?.(!visible);
        else setInternalShow(v => !v);
    };

    return (
        <div className={className}>
            <input
                type={visible ? 'text' : 'password'}
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full px-4 py-2.5 rounded-lg border outline-none focus:border-[var(--accent-primary)] text-sm pr-10"
                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                onKeyDown={onEnter ? (e => e.key === 'Enter' && onEnter()) : undefined}
            />
            <button
                type="button"
                onClick={toggleShow}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-white/10"
                style={{ color: 'var(--text-muted)' }}
                title={visible ? 'Hide' : 'Show'}
            >
                {visible ? '👁️' : '👁️‍🗨️'}
            </button>
        </div>
    );
};

export default SecretInput;
