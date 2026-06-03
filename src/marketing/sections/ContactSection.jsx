import React from 'react';
import CustomerSupport, { SUPPORT_DEFAULT_CONTENT } from './CustomerSupport';

/**
 * Legacy contact section — thin compatibility wrapper.
 *
 * The actual form (and its support-thread backend wiring + AI-reply polling)
 * now lives in CustomerSupport, which is also the CMS-placeable "Customer
 * Support" block. This wrapper keeps the static HomePage / PricingPage call
 * sites (`<ContactSection />`, anchored at #contact) working unchanged while
 * sharing a single implementation.
 */
export default function ContactSection({ id = 'contact' }) {
    return (
        <CustomerSupport
            sectionId={id}
            data={{ enabled: true, ...SUPPORT_DEFAULT_CONTENT }}
        />
    );
}
