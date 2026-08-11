/**
 * RichTextEditor — mounts BeeEditor, the in-house editor engine.
 *
 * This used to switch between BeeEditor and a legacy TipTap editor via an
 * `engine` prop. BeeEditor had been the default on every surface for a while and
 * the TipTap path was a kill-switch nobody set; because the import was static,
 * every user downloaded the whole TipTap tree to run code that never executed.
 * Both are gone. The `engine` prop is accepted and ignored so any stale caller
 * keeps working.
 *
 * The editor is wrapped in an error boundary: if a transform/render throws on
 * malformed content, the user keeps their last-saved work and gets a retry action
 * instead of an unmounted (blank) editor.
 */
import React, { forwardRef } from 'react';
import BeeEditor from './BeeEditor.jsx';
import useTranslation from '../../hooks/useTranslation';

class EditorErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, attempt: 0 };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[BeeEditor] crashed — recovering with boundary', error, info);
  }

  retry = () => {
    // Bump `attempt` to remount the child fresh; it reloads from the content prop.
    this.setState((s) => ({ error: null, attempt: s.attempt + 1 }));
  };

  render() {
    if (this.state.error) {
      const L = this.props.labels || {};
      return (
        <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center"
          style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {L.title || 'The editor ran into a problem'}
          </p>
          <p className="text-xs max-w-sm" style={{ color: 'var(--text-tertiary)' }}>
            {L.body || 'Your last saved version is safe. Try reloading the editor.'}
          </p>
          <button onClick={this.retry}
            className="px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ background: 'var(--accent-primary)', color: 'white' }}>
            {L.retry || 'Reload editor'}
          </button>
        </div>
      );
    }
    return <React.Fragment key={this.state.attempt}>{this.props.children}</React.Fragment>;
  }
}

// `engine` is destructured purely to keep it off the DOM-bound prop spread.
const RichTextEditor = forwardRef(function RichTextEditor({ engine: _engine, ...props }, ref) {
  const { t } = useTranslation();
  const labels = {
    title: t('notebooks.editor_error_title', 'The editor ran into a problem'),
    body: t('notebooks.editor_error_body', 'Your last saved version is safe. Try reloading the editor.'),
    retry: t('notebooks.editor_error_retry', 'Reload editor'),
  };
  return (
    <EditorErrorBoundary labels={labels}>
      <BeeEditor ref={ref} {...props} />
    </EditorErrorBoundary>
  );
});

export default RichTextEditor;
