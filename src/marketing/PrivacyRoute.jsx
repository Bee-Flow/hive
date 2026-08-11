import React from 'react';
import LegalPage from './LegalPage';
import privacyMd from './legal/privacy.md?raw';

/**
 * /privacy — a lazy wrapper whose only job is to keep the bundled markdown
 * OUT of the entry chunk. The `?raw` import used to sit in App.jsx, which
 * inlined the entire legal text into JavaScript every visitor parses; here it
 * ships inside this route's own chunk, fetched only when someone actually
 * opens the page. LegalPage still fetches the localized version by docId and
 * uses this bundled English source as its offline fallback.
 */
export default function PrivacyRoute() {
    return <LegalPage docId="privacy" title="Privacy Policy" source={privacyMd} />;
}
