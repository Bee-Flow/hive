import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SignupWizard from './SignupWizard';

// The wizard shell is what we're testing; the step bodies are heavy (API calls,
// OAuth, consent registry) so they're stubbed down to identifiable markers.
vi.mock('./SignupStepWelcome', () => ({ default: () => <div>STEP:welcome</div> }));
vi.mock('./SignupStepOrg', () => ({ default: () => <div>STEP:type</div> }));
vi.mock('./SignupStepAuth', () => ({ default: () => <div>STEP:auth</div> }));
vi.mock('./SignupStepPrivacy', () => ({ default: () => <div>STEP:privacy</div> }));
vi.mock('./SignupStepAccount', () => ({ default: () => <div>STEP:account</div> }));
vi.mock('../../hooks/useTranslation', () => ({
    useTranslation: () => ({ t: (_k, fallback, vars) => {
        if (typeof fallback !== 'string') return _k;
        return fallback.replace(/\{(\w+)\}/g, (m, name) => (vars?.[name] ?? m));
    } }),
}));
vi.mock('../../assets/bee-flow-logo.png', () => ({ default: 'logo.png' }), { virtual: true });

const BASE_DATA = {
    signupType: 'consumer', authMethod: 'password',
    shieldEnabled: true, piiCategories: ['Email'], piiAction: 'tokenize', euModeEnabled: false,
};

function renderWizard(signupData = BASE_DATA, props = {}) {
    return render(
        <SignupWizard
            signupData={signupData}
            setSignupData={vi.fn()}
            setError={vi.fn()}
            resetSignup={vi.fn()}
            handleSignup={vi.fn()}
            setIsLoading={vi.fn()}
            isLoading={false}
            signupOrgs={[]}
            consumerLoginMethods={['password', 'google']}
            availableLocales={[]}
            {...props}
        />,
    );
}

describe('SignupWizard step path', () => {
    it('BFSF-289: the consumer flow includes the Privacy Shield step', () => {
        renderWizard();
        // 5 steps: welcome → type → auth → privacy → account
        expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
    });

    it('BFSF-289: consumer flow keeps the privacy step when auth is pre-selected', () => {
        renderWizard(BASE_DATA, { consumerLoginMethods: ['password'] });
        // 4 steps: welcome → type → privacy → account (auth is skipped, privacy is not)
        expect(screen.getByText('Step 1 of 4')).toBeInTheDocument();
    });

    it('the org flow is unchanged (welcome → type → auth → privacy → account)', () => {
        renderWizard({ ...BASE_DATA, signupType: 'new' });
        expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
    });

    it('joining an existing org still skips the privacy step (the org owns it)', () => {
        renderWizard({ ...BASE_DATA, signupType: 'existing' });
        expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
    });

    it('an invite is a single step', () => {
        renderWizard(BASE_DATA, { inviteInfo: { orgName: 'ELGO' } });
        expect(screen.getByText('STEP:account')).toBeInTheDocument();
    });
});

/**
 * BFSF-276 — step 1 rendered the "…set up your organisation…" line for
 * everyone, because the org-vs-personal choice is only made on step 2 and the
 * ternary fell through to the org branch while signupType was still unset.
 * The mocked t() returns the fallback string, so these assert the exact copy
 * the user reads.
 */
describe('SignupWizard welcome copy (BFSF-276)', () => {
    const ORG_COPY = /set up your organisation/i;
    const NEUTRAL_COPY = /Let's set up your account on Bee Flow/i;
    const CONSUMER_COPY = /create your personal Bee Flow account/i;

    it('is account-type-agnostic before the type has been chosen', () => {
        // signupType absent — exactly the state a first-time visitor is in on
        // step 1, one screen before they are offered the personal option.
        renderWizard({ ...BASE_DATA, signupType: undefined });
        expect(screen.getByText(NEUTRAL_COPY)).toBeInTheDocument();
        expect(screen.queryByText(ORG_COPY)).toBeNull();
    });

    it('never says "organisation" on step 1 for an empty-string type either', () => {
        renderWizard({ ...BASE_DATA, signupType: '' });
        expect(screen.queryByText(ORG_COPY)).toBeNull();
    });

    it('still shows the org copy once the user has picked a new organisation', () => {
        renderWizard({ ...BASE_DATA, signupType: 'new' });
        expect(screen.getByText(ORG_COPY)).toBeInTheDocument();
    });

    it('still shows the org copy when joining an existing organisation', () => {
        renderWizard({ ...BASE_DATA, signupType: 'existing' });
        expect(screen.getByText(ORG_COPY)).toBeInTheDocument();
    });

    it('still shows the personal copy for a consumer account', () => {
        renderWizard({ ...BASE_DATA, signupType: 'consumer' });
        expect(screen.getByText(CONSUMER_COPY)).toBeInTheDocument();
        expect(screen.queryByText(ORG_COPY)).toBeNull();
    });
});
