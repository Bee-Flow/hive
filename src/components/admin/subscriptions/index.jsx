import React, { useState } from 'react';
import { SubscriptionsShell } from './SubscriptionsShell';
import { ToastProvider } from './ui/Toast';

import { PlansView }    from './plans/PlansView';
import { OrgsView }     from './orgs/OrgsView';
import { GrantsView }   from './grants/GrantsView';
import { AccessView }   from './access/AccessView';
import { PromosView }   from './promos/PromosView';
import { StripeView }   from './stripe/StripeView';
import { AuditView }    from './audit/AuditView';

function SubscriptionsPanel() {
    const [active, setActive] = useState('plans');

    return (
        <ToastProvider>
            <SubscriptionsShell active={active} onChange={setActive}>
                {active === 'plans'         && <PlansView />}
                {active === 'organizations' && <OrgsView />}
                {active === 'grants'        && <GrantsView />}
                {active === 'access'        && <AccessView />}
                {active === 'promos'        && <PromosView />}
                {active === 'settings'      && <StripeView />}
                {active === 'audit'         && <AuditView />}
            </SubscriptionsShell>
        </ToastProvider>
    );
}

export default SubscriptionsPanel;
