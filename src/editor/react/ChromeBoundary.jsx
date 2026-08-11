/**
 * ChromeBoundary — error boundary for the editor's floating chrome.
 *
 * The editor already sits inside an error boundary (RichTextEditor), but that
 * one wraps everything: a throw in an optional overlay — a table gutter, a
 * bubble menu — takes the document down with it and the user stares at "The
 * editor ran into a problem" with their content gone until they hit reload.
 * That is what BFSF-351 looked like from the outside.
 *
 * Chrome is optional; the document is not. So this boundary renders *nothing*
 * on failure: the affordance disappears, the text stays on screen and stays
 * editable. It is deliberately silent to the user and loud in the console.
 *
 * Each usage unmounts when its trigger goes away (e.g. the caret leaves the
 * table), which remounts a fresh boundary next time — no manual reset needed.
 */
import React from 'react';

class ChromeBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error(`[BeeEditor] ${this.props.label || 'chrome'} crashed — hiding it`, error, info);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default ChromeBoundary;
