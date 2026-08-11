import React from 'react';
import LegalPage from './LegalPage';
import termsMd from './legal/terms.md?raw';

/** /terms — see PrivacyRoute.jsx for why this wrapper exists. */
export default function TermsRoute() {
    return <LegalPage docId="terms" title="Terms of Service" source={termsMd} />;
}
