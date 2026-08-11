/**
 * Signup validation — one place, for both account types.
 *
 * Validation used to live in two: SignupWizard.canAdvance() decided whether the
 * Next button lit up, and LoginPage.handleSignup() decided whether the request
 * was allowed to leave. They disagreed — the wizard required KvK and VAT, the
 * submit path did not; the submit path enforced a password minimum, the wizard
 * did not — so which rules applied depended on which button you pressed.
 */

/**
 * Must match MIN_PASSWORD_LENGTH in server/auth/passwordPolicy.js. The server
 * is authoritative; this only spares the user a round-trip. Signup used to
 * accept 4 characters while password reset already required 8.
 */
export const MIN_PASSWORD_LENGTH = 8;

/** Countries whose company registration we collect at signup. */
const REGISTRATION_REQUIRED_COUNTRIES = ['nl'];

/**
 * Are the Dutch chamber-of-commerce (KvK) and VAT numbers mandatory here?
 *
 * They used to be mandatory for every organisation, which meant a German or
 * Belgian company simply could not finish signing up — the Next button never
 * enabled and nothing said why. Now they are required only where we actually
 * need them, and optional (still collected) elsewhere.
 */
export function requiresDutchRegistration(signupData = {}, locale = '') {
    const country = String(
        signupData.orgCountry || signupData.country || '',
    ).trim().toLowerCase();
    if (country) return REGISTRATION_REQUIRED_COUNTRIES.includes(country);
    // No explicit country yet: fall back to the UI language, which is the only
    // signal available on the org step.
    return REGISTRATION_REQUIRED_COUNTRIES.includes(String(locale || '').toLowerCase());
}

const isNonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;

/**
 * Can the wizard advance past `step`?
 * @returns {{ok: boolean, reason?: string}}
 */
export function validateStep(step, signupData = {}, { locale = '' } = {}) {
    switch (step) {
        case 'welcome':
            return { ok: true };

        case 'type': {
            const type = signupData.signupType;
            if (type === 'new') {
                if (!isNonEmpty(signupData.newOrgName)) return { ok: false, reason: 'org_name_required' };
                if (requiresDutchRegistration(signupData, locale)) {
                    if (!isNonEmpty(signupData.orgKvk)) return { ok: false, reason: 'kvk_required' };
                    if (!isNonEmpty(signupData.orgVat)) return { ok: false, reason: 'vat_required' };
                }
                return { ok: true };
            }
            if (type === 'existing') {
                return isNonEmpty(signupData.organizationId)
                    ? { ok: true }
                    : { ok: false, reason: 'organization_required' };
            }
            return { ok: true }; // consumer
        }

        case 'plan':
            // A plan is optional: skipping it lands the account on the default
            // plan, exactly as signup did before this step existed.
            return { ok: true };

        case 'auth':
            return isNonEmpty(signupData.authMethod)
                ? { ok: true }
                : { ok: false, reason: 'auth_method_required' };

        case 'privacy':
            // An enabled shield with no categories selected detects nothing.
            if (signupData.shieldEnabled === false) return { ok: true };
            return (signupData.piiCategories || []).length > 0
                ? { ok: true }
                : { ok: false, reason: 'pii_categories_required' };

        case 'account':
            return { ok: true }; // the account step owns its own submit validation

        default:
            return { ok: true };
    }
}

/**
 * Final gate before POST /auth/signup. Re-checks every step's rules, so a user
 * who reached the last step through an odd path still can't submit a form the
 * server will reject.
 *
 * @returns {{ok: boolean, error?: string, reason?: string}}
 */
export function validateSubmit(signupData = {}, { locale = '', isInvite = false, t = (_k, d) => d } = {}) {
    if (!isNonEmpty(signupData.username)) {
        return { ok: false, reason: 'username_required', error: t('signup.err_username_required', 'Please choose a username.') };
    }
    if (signupData.username.trim() === 'admin') {
        return { ok: false, reason: 'username_reserved', error: t('signup.err_username_reserved', 'This username is not available.') };
    }
    if (!isNonEmpty(signupData.password) || signupData.password.length < MIN_PASSWORD_LENGTH) {
        return {
            ok: false,
            reason: 'password_too_short',
            error: t('signup.err_password_length', 'Password must be at least {n} characters.')
                .replace('{n}', String(MIN_PASSWORD_LENGTH)),
        };
    }
    if (isNonEmpty(signupData.email) && !isPlausibleEmail(signupData.email)) {
        return { ok: false, reason: 'email_invalid', error: t('signup.err_email_invalid', 'Please enter a valid email address.') };
    }

    // Invited users skip the account-type rules entirely: the invite already
    // determines the organisation they join.
    if (!isInvite) {
        const typeCheck = validateStep('type', signupData, { locale });
        if (!typeCheck.ok) {
            return { ok: false, reason: typeCheck.reason, error: messageForReason(typeCheck.reason, t) };
        }
    }
    return { ok: true };
}

/**
 * Deliberately permissive — the address is confirmed by a verification email,
 * so the only job here is catching obvious typos, not enforcing RFC 5322.
 */
export function isPlausibleEmail(value) {
    const s = String(value || '').trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}

function messageForReason(reason, t) {
    switch (reason) {
        case 'org_name_required': return t('signup.err_org_name', 'Please enter your organisation name.');
        case 'kvk_required': return t('signup.err_kvk', 'Please enter your Chamber of Commerce (KvK) number.');
        case 'vat_required': return t('signup.err_vat', 'Please enter your VAT number.');
        case 'organization_required': return t('signup.err_org_select', 'Please select an organisation.');
        default: return t('signup.err_generic', 'Please complete the required fields.');
    }
}
