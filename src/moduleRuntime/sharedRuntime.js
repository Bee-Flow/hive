// Single-React contract — step 1 of 3.
//
// Runtime-loaded module bundles (installed remote modules) externalize the
// React family so they don't ship a second copy of React. A second React
// instance would break hooks and context the moment a module renders inside the
// host tree. To guarantee ONE React, we publish the host's React family to a
// global here; the static shims in public/module-shims/ (step 2) re-export from
// this global, and the inline import map in index.html (step 3) points every
// bare `react*` specifier a module bundle imports at those shims.
//
// This module MUST be imported first in main.jsx so the global exists before
// any module bundle is dynamically imported.
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';
import * as JsxRuntime from 'react/jsx-runtime';

const shared = {
    react: React,
    'react-dom': ReactDOM,
    'react-dom/client': ReactDOMClient,
    'react/jsx-runtime': JsxRuntime,
};

if (typeof window !== 'undefined') {
    // Assigned unconditionally: main.jsx is the single entry, so this runs once.
    window.__BEEFLOW_SHARED__ = shared;
}

export default shared;
