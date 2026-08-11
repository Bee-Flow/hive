/**
 * Starter regex collections, one per country plus three thematic ones.
 *
 * These are TEMPLATES, offered from the empty state. Nothing here is seeded:
 * these rules feed `checkRegexPatterns`, which REDACTS matches as
 * `[REDACTED: <rule name>]` for every organisation bound to the collection, so
 * installing them behind an admin's back would silently change what every tenant
 * sees. An admin picks a set, reviews it, and saves.
 *
 * NOT a mirror of the guard service's detector (guard-service/app/services/
 * pii_regex.py), and it must not become one. Two different jobs:
 *
 *   * the detector does PII detection with checksums, context anchors and
 *     region scoping, and its output can be TOKENISED and restored;
 *   * this layer is flat pattern redaction that runs inside the Node process.
 *
 * The overlap is deliberate — this layer keeps working when the guard is
 * unreachable, which is precisely the condition that made users see "Privacy
 * protection is temporarily unavailable". A fail-open organisation with a country
 * collection bound still gets its national identifiers removed.
 *
 * ENGINE CONSTRAINTS (server/core/guardrails.js compiles these):
 *   - `new RegExp(pattern, 'i')` — always case-insensitive, so `[A-Z]` also
 *     matches lowercase. Do not rely on case to disambiguate.
 *   - the `u` flag is never passed, so `\p{L}` and friends are unavailable.
 *   - a leading `(?i)` is stripped; other inline flags are not.
 *   - an invalid pattern is silently skipped, which is why starterSets.test.js
 *     compiles every one of them.
 *   - the rule NAME is user-visible inside the redaction marker, so it has to
 *     read as an explanation rather than an internal key.
 *
 * Patterns here are intentionally shape-only: this engine cannot run a checksum,
 * and a shape-only pattern that over-matches is a redaction the user can see and
 * report, not a leak. Anything genuinely ambiguous on its own (bare digit runs)
 * is left to the detector.
 */

/** Stable ids so re-applying a template updates rather than duplicates. */
const rule = (id, name, pattern) => ({ id: `starter_${id}`, name, pattern });

const RULES = {
    // ── Country identifiers ────────────────────────────────────────────
    nl_bsn: rule('nl_bsn', 'Dutch BSN', '\\b\\d{9}\\b'),
    nl_btw: rule('nl_btw', 'Dutch VAT (BTW)', '\\bNL\\d{9}B\\d{2}\\b'),
    nl_plate: rule('nl_plate', 'Dutch licence plate',
        '\\b(?:\\d{2}-[A-Z]{2}-\\d{2}|[A-Z]{2}-\\d{2}-[A-Z]{2}|\\d{2}-[A-Z]{3}-\\d|\\d-[A-Z]{3}-\\d{2}|[A-Z]{2}-\\d{3}-[A-Z]|[A-Z]-\\d{3}-[A-Z]{2})\\b'),

    be_natid: rule('be_natid', 'Belgian national number', '\\b\\d{2}\\.\\d{2}\\.\\d{2}-\\d{3}\\.\\d{2}\\b'),
    be_vat: rule('be_vat', 'Belgian VAT', '\\bBE\\s?0\\d{9}\\b'),
    be_plate: rule('be_plate', 'Belgian licence plate', '\\b[12]-[A-Z]{3}-\\d{3}\\b'),

    de_vat: rule('de_vat', 'German VAT (USt-IdNr)', '\\bDE\\s?\\d{9}\\b'),
    de_svnr: rule('de_svnr', 'German social insurance number', '\\b\\d{2}[A-Z]\\d{6}[A-Z]\\d{3}\\b'),
    de_plate: rule('de_plate', 'German licence plate', '\\b[A-Z]{1,3}-[A-Z]{1,2}\\s?\\d{2,4}\\b'),

    fr_nir: rule('fr_nir', 'French social security number (NIR)',
        '\\b[12][\\s.]?\\d{2}[\\s.]?\\d{2}[\\s.]?(?:\\d{2}|2[AB])[\\s.]?\\d{3}[\\s.]?\\d{3}[\\s.]?\\d{2}\\b'),
    fr_vat: rule('fr_vat', 'French VAT (TVA)', '\\bFR\\s?\\d{2}\\s?\\d{9}\\b'),
    fr_plate: rule('fr_plate', 'French licence plate', '\\b[A-Z]{2}-\\d{3}-[A-Z]{2}\\b'),

    es_dni: rule('es_dni', 'Spanish DNI / NIE', '\\b(?:[XYZ]\\d{7}|\\d{8})[A-Z]\\b'),
    es_vat: rule('es_vat', 'Spanish VAT (NIF)', '\\bES\\s?[A-Z0-9]\\d{7}[A-Z0-9]\\b'),
    es_plate: rule('es_plate', 'Spanish licence plate', '\\b\\d{4}\\s?[BCDFGHJKLMNPRSTVWXYZ]{3}\\b'),

    it_cf: rule('it_cf', 'Italian codice fiscale',
        '\\b[A-Z]{6}\\d{2}[ABCDEHLMPRST]\\d{2}[A-Z]\\d{3}[A-Z]\\b'),
    it_vat: rule('it_vat', 'Italian VAT (partita IVA)', '\\bIT\\s?\\d{11}\\b'),
    it_plate: rule('it_plate', 'Italian licence plate', '\\b[A-Z]{2}\\s?\\d{3}\\s?[A-Z]{2}\\b'),

    pl_vat: rule('pl_vat', 'Polish VAT (NIP)', '\\b(?:PL\\s?\\d{10}|\\d{3}-\\d{3}-\\d{2}-\\d{2})\\b'),
    pl_plate: rule('pl_plate', 'Polish licence plate', '\\b[A-Z]{2,3}\\s\\d{4,5}\\b'),

    se_personnummer: rule('se_personnummer', 'Swedish personnummer', '\\b(?:\\d{2})?\\d{6}[-+]\\d{4}\\b'),
    se_vat: rule('se_vat', 'Swedish VAT', '\\bSE\\s?\\d{12}\\b'),

    at_svnr: rule('at_svnr', 'Austrian social insurance number', '\\b\\d{4}\\s\\d{6}\\b'),
    at_vat: rule('at_vat', 'Austrian VAT (UID)', '\\bATU\\d{8}\\b'),

    us_ssn: rule('us_ssn', 'US Social Security number', '\\b\\d{3}-\\d{2}-\\d{4}\\b'),
    us_itin: rule('us_itin', 'US ITIN', '\\b9\\d{2}-(?:7\\d|8[0-8])-\\d{4}\\b'),
    us_ein: rule('us_ein', 'US EIN', '\\b\\d{2}-\\d{7}\\b'),
    us_phone: rule('us_phone', 'US phone number',
        '\\b(?:\\(\\d{3}\\)\\s?|\\d{3}[\\s.-])\\d{3}[\\s.-]\\d{4}\\b'),

    // ── Thematic ──────────────────────────────────────────────────────
    iban: rule('iban', 'IBAN', '\\b[A-Z]{2}\\d{2}[A-Z0-9]{10,30}\\b'),
    credit_card: rule('credit_card', 'Payment card number', '\\b(?:\\d[ -]?){12,18}\\d\\b'),
    // No SWIFT/BIC rule. A BIC is 8 or 11 alphanumerics with at least the first
    // six alphabetic, and this engine always compiles case-insensitively — so the
    // pattern reduces to "any eight-letter word" and redacted `nakijken` out of an
    // ordinary Dutch sentence. There is no case-blind way to tell a BIC from a
    // word, so the honest answer is not to ship one. A BIC almost always appears
    // next to an IBAN, which the rule above covers.

    key_openai: rule('key_openai', 'OpenAI API key', '\\bsk-[A-Za-z0-9_-]{20,}\\b'),
    key_aws: rule('key_aws', 'AWS access key id', '\\bAKIA[0-9A-Z]{16}\\b'),
    key_github: rule('key_github', 'GitHub token', '\\bgh[pousr]_[A-Za-z0-9]{36}\\b'),
    key_slack: rule('key_slack', 'Slack token', '\\bxox[baprs]-[A-Za-z0-9-]{10,}\\b'),
    key_google: rule('key_google', 'Google API key', '\\bAIza[0-9A-Za-z_-]{35}\\b'),
    key_stripe: rule('key_stripe', 'Stripe secret key', '\\b(?:sk|rk)_(?:live|test)_[0-9A-Za-z]{16,}\\b'),
    key_jwt: rule('key_jwt', 'JWT', '\\beyJ[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,}\\b'),
    key_private: rule('key_private', 'Private key block', '-----BEGIN[A-Z ]{0,20}PRIVATE KEY-----'),
};

/**
 * @typedef {{id: string, name: string, description: string,
 *            ruleIds: string[]}} StarterSet
 */

/** @type {StarterSet[]} */
export const STARTER_SETS = [
    {
        id: 'nl',
        name: 'Netherlands — identifiers',
        description: 'BSN, VAT (BTW) and RDW licence plates.',
        ruleIds: ['nl_bsn', 'nl_btw', 'nl_plate'],
    },
    {
        id: 'be',
        name: 'Belgium — identifiers',
        description: 'National number, VAT and licence plates.',
        ruleIds: ['be_natid', 'be_vat', 'be_plate'],
    },
    {
        id: 'de',
        name: 'Germany — identifiers',
        description: 'VAT (USt-IdNr), social insurance number and licence plates.',
        ruleIds: ['de_vat', 'de_svnr', 'de_plate'],
    },
    {
        id: 'fr',
        name: 'France — identifiers',
        description: 'Social security number (NIR), VAT and licence plates.',
        ruleIds: ['fr_nir', 'fr_vat', 'fr_plate'],
    },
    {
        id: 'es',
        name: 'Spain — identifiers',
        description: 'DNI/NIE, VAT and licence plates.',
        ruleIds: ['es_dni', 'es_vat', 'es_plate'],
    },
    {
        id: 'it',
        name: 'Italy — identifiers',
        description: 'Codice fiscale, partita IVA and licence plates.',
        ruleIds: ['it_cf', 'it_vat', 'it_plate'],
    },
    {
        id: 'pl',
        name: 'Poland — identifiers',
        description: 'VAT (NIP) and licence plates. PESEL is nine bare digits and is left to the detector.',
        ruleIds: ['pl_vat', 'pl_plate'],
    },
    {
        id: 'se',
        name: 'Sweden — identifiers',
        description: 'Personnummer and VAT.',
        ruleIds: ['se_personnummer', 'se_vat'],
    },
    {
        id: 'at',
        name: 'Austria — identifiers',
        description: 'Social insurance number and VAT (UID).',
        ruleIds: ['at_svnr', 'at_vat'],
    },
    {
        id: 'us',
        name: 'United States — identifiers',
        description: 'SSN, ITIN, EIN and phone numbers.',
        ruleIds: ['us_ssn', 'us_itin', 'us_ein', 'us_phone'],
    },
    {
        id: 'payment',
        name: 'Payment data',
        description: 'IBAN and payment card numbers.',
        ruleIds: ['iban', 'credit_card'],
    },
    {
        id: 'secrets',
        name: 'Secrets & API keys',
        description: 'Vendor key formats, JWTs and private-key blocks.',
        ruleIds: ['key_openai', 'key_aws', 'key_github', 'key_slack',
            'key_google', 'key_stripe', 'key_jwt', 'key_private'],
    },
    {
        id: 'eu_vat',
        name: 'EU VAT numbers',
        description: 'VAT number formats across the countries above, without the other identifiers.',
        ruleIds: ['nl_btw', 'be_vat', 'de_vat', 'fr_vat', 'es_vat', 'it_vat',
            'pl_vat', 'se_vat', 'at_vat'],
    },
];

/** Every rule a starter set can reference, keyed by its short id. */
export const STARTER_RULES = RULES;

/**
 * Merge a starter set into an existing library.
 *
 * Additive and idempotent, both on purpose. An admin applying "Netherlands" and
 * then "EU VAT numbers" must not end up with two Dutch VAT rules under two ids —
 * the collections reference rules BY ID, and a duplicate would be invisible in
 * the UI while doubling the redaction work.
 *
 * Rules the admin has already edited are left alone: a template must never
 * overwrite a pattern someone deliberately changed.
 *
 * @returns {{rules: object[], collections: object[], addedRules: number,
 *            addedCollection: boolean}}
 */
export function applyStarterSet(set, rules, collections) {
    const byId = new Map(rules.map(r => [r.id, r]));
    const nextRules = [...rules];
    let addedRules = 0;

    for (const shortId of set.ruleIds) {
        const template = RULES[shortId];
        if (!template) continue;                 // unknown id in a set definition
        if (byId.has(template.id)) continue;     // already present, keep theirs
        nextRules.push({ ...template });
        byId.set(template.id, template);
        addedRules += 1;
    }

    const collectionId = `starter_col_${set.id}`;
    const ruleIds = set.ruleIds.map(s => RULES[s]?.id).filter(Boolean);
    const existing = collections.find(c => c.id === collectionId);
    const nextCollections = existing
        // Re-applying refreshes the membership so a set that gained a rule in a
        // later release actually delivers it.
        ? collections.map(c => (c.id === collectionId
            ? { ...c, ruleIds: [...new Set([...c.ruleIds, ...ruleIds])] }
            : c))
        : [...collections, { id: collectionId, name: set.name, ruleIds }];

    return {
        rules: nextRules,
        collections: nextCollections,
        addedRules,
        addedCollection: !existing,
    };
}
