import { useRef, useEffect } from 'react';
import { classifyLine } from '../constants';

export function Toggle({ checked, onChange, label, activeLabel }) {
  return (
    <div className={`toggle-switch ${checked ? 'active' : ''}`} onClick={() => onChange(!checked)}>
      <div className="toggle-track"><div className="toggle-thumb" /></div>
      <span className="toggle-label">{checked ? activeLabel : label}</span>
    </div>
  );
}

export function Terminal({ lines, running, title }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines]);

  return (
    <div className="terminal">
      <div className="terminal-header">
        <div className="terminal-dot red" />
        <div className="terminal-dot yellow" />
        <div className="terminal-dot green" />
        <span className="terminal-title">{title || 'Terminal'}</span>
      </div>
      <div className="terminal-body" ref={ref}>
        {lines.map((line, i) => (
          <div key={i} className={`terminal-line ${classifyLine(line)}`}>{line}</div>
        ))}
        {running && <span className="terminal-cursor" />}
      </div>
    </div>
  );
}

export function Lightbox({ src, alt, onClose }) {
  return (
    <div className="lightbox" onClick={onClose}>
      <button className="lightbox-close" onClick={onClose}>✕</button>
      <img src={src} alt={alt} onClick={(e) => e.stopPropagation()} />
    </div>
  );
}

export function StepCodeBlock({ code, error }) {
  if (!code) return null;
  return (
    <pre style={{
      padding: 16, background: '#1e293b', color: '#e2e8f0',
      fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.7,
      overflow: 'auto', maxHeight: 200, borderRadius: 'var(--radius-md)',
      border: `1px solid ${error ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.1)'}`,
    }}>
      {code}
    </pre>
  );
}
