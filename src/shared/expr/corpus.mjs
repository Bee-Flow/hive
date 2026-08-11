/**
 * Golden expression corpus — the anti-drift contract.
 *
 * Imported by BOTH the server test (shared/expr/engine.test.mjs under
 * `node --test`) and the client parity test (agent-hub vitest), and each side
 * asserts `evaluate(expr, scope)` deepEquals `expected`. Because both import
 * the identical engine AND the client test additionally cross-checks against
 * the server's re-export, any divergence between Node and the browser build is
 * a test failure.
 *
 * Add a case here (not in one runner) whenever the grammar/whitelist changes.
 */

export const SCOPE = {
    actions: { search: { status: 'success', result: { count: 3, rows: [{ name: 'A' }, { name: 'B' }] } } },
    form: { amount: 120, email: 'a@b.com', qty: 0 },
    item: { total: 50, region: 'EU', tags: ['x', 'y'] },
    currentUser: { id: 'u1', role: 'manager', name: 'Tom' },
    vars: { rate: 1.21 },
    now: '2026-07-04T12:00:00Z',
    today: '2026-07-04',
    weird: { constructor: 'SHOULD_NOT_LEAK', __proto__: { poisoned: true } },
    rawJson: '{"user":{"name":"Ada"},"items":[{"sku":"a1","qty":2},{"sku":"b2","qty":0}]}',
    badJson: '{oops',
};

export const CASES = [
    // literals + arithmetic
    { expr: '1 + 2 * 3', expected: 7 },
    { expr: '(1 + 2) * 3', expected: 9 },
    { expr: '10 % 3', expected: 1 },
    { expr: '-5 + 3', expected: -2 },
    { expr: '2.5 + 0.5', expected: 3 },
    // strings + booleans + ternary
    { expr: '"a" + "b"', expected: 'ab' },
    { expr: 'true && false', expected: false },
    { expr: 'true || false', expected: true },
    { expr: '!false', expected: true },
    { expr: '1 < 2 ? "yes" : "no"', expected: 'yes' },
    // comparison (loose vs strict)
    { expr: '1 == "1"', expected: true },
    { expr: '1 === "1"', expected: false },
    { expr: '2 != 3', expected: true },
    // path access (dot + bracket)
    { expr: 'form.amount', expected: 120 },
    { expr: 'actions.search.result.count', expected: 3 },
    { expr: 'actions.search.result.rows[0].name', expected: 'A' },
    { expr: 'actions.search.result.rows[1].name', expected: 'B' },
    { expr: 'item.tags[1]', expected: 'y' },
    { expr: 'missing.path.here', expected: undefined },
    { expr: 'currentUser.role == "manager"', expected: true },
    // string members — a PRIMITIVE is read with the same own-property rule as
    // an object (server/automation/bind.js resolveTokens has always done this,
    // relying on hasOwnProperty.call auto-boxing). The engine used to gate
    // member access on `typeof cur === 'object'`, so `…body.length > 5` was
    // permanently false in a condition while the identical path in a ref
    // binding resolved to a number. These cases pin the two together.
    { expr: 'form.email.length', expected: 7 },
    { expr: 'form.email.length > 5', expected: true },
    { expr: 'currentUser.name[0]', expected: 'T' },
    { expr: 'item.tags[0].length', expected: 1 },
    { expr: 'form.email.toUpperCase', expected: undefined },  // string prototype method stays blocked
    { expr: 'form.amount.toFixed', expected: undefined },     // a number has no own properties at all
    // original whitelist
    { expr: 'contains(form.email, "@")', expected: true },
    { expr: 'startsWith(currentUser.name, "T")', expected: true },
    { expr: 'endsWith(form.email, ".com")', expected: true },
    { expr: 'lower(currentUser.name)', expected: 'tom' },
    { expr: 'upper(item.region)', expected: 'EU' },
    { expr: 'len(item.tags)', expected: 2 },
    { expr: 'isEmpty("")', expected: true },
    { expr: 'isEmpty(item.tags)', expected: false },
    // extended: numeric
    { expr: 'number("42")', expected: 42 },
    { expr: 'number("nope")', expected: null },
    { expr: 'round(3.14159, 2)', expected: 3.14 },
    { expr: 'round(2.5)', expected: 3 },
    { expr: 'floor(2.9)', expected: 2 },
    { expr: 'ceil(2.1)', expected: 3 },
    { expr: 'abs(-7)', expected: 7 },
    { expr: 'min(3, 1, 2)', expected: 1 },
    { expr: 'max(3, 1, 2)', expected: 3 },
    { expr: 'clamp(15, 0, 10)', expected: 10 },
    { expr: 'sum(item.tags)', expected: 0 },
    { expr: 'form.amount * vars.rate', expected: 145.2 },
    // extended: null/logic
    { expr: 'coalesce(missing.x, form.qty, 99)', expected: 0 },
    { expr: 'coalesce(missing.x, missing.y)', expected: null },
    { expr: 'default(missing.x, "fallback")', expected: 'fallback' },
    { expr: 'ifNull(form.amount, 0)', expected: 120 },
    // extended: string
    { expr: 'trim("  hi  ")', expected: 'hi' },
    { expr: 'concat("a", "-", "b")', expected: 'a-b' },
    { expr: 'replace("a.b.c", ".", "/")', expected: 'a/b/c' },
    { expr: 'join(item.tags, ",")', expected: 'x,y' },
    { expr: 'substring("hello", 1, 3)', expected: 'el' },
    { expr: 'toStr(form.amount)', expected: '120' },
    // extended: array
    { expr: 'first(item.tags)', expected: 'x' },
    { expr: 'last(item.tags)', expected: 'y' },
    { expr: 'includes(item.tags, "y")', expected: true },
    { expr: 'count(actions.search.result.rows)', expected: 2 },
    // extended: date (UTC-deterministic)
    { expr: 'year(now)', expected: 2026 },
    { expr: 'month(today)', expected: 7 },
    { expr: 'day(today)', expected: 4 },
    { expr: 'formatDate(now, "YYYY-MM-DD")', expected: '2026-07-04' },
    { expr: 'formatDate(now, "HH:mm")', expected: '12:00' },
    { expr: 'dateDiff("2026-07-10", today, "day")', expected: 6 },
    { expr: 'isBefore(today, "2026-12-31")', expected: true },
    { expr: 'isAfter(now, "2026-01-01T00:00:00Z")', expected: true },
    { expr: 'formatDate(dateAdd(today, 1, "day"), "YYYY-MM-DD")', expected: '2026-07-05' },
    // extended: JSON (parseJson never throws; two-arg path form because the
    // grammar has no member access on a call result)
    { expr: 'parseJson(rawJson, "user.name")', expected: 'Ada' },
    { expr: 'parseJson(rawJson, "items[0].qty")', expected: 2 },
    { expr: 'parseJson(rawJson, "items[*].sku")', expected: ['a1', 'b2'] },
    { expr: 'join(parseJson(rawJson, "items[*].sku"), ",")', expected: 'a1,b2' }, // composition
    { expr: 'parseJson(badJson)', expected: null },
    { expr: 'parseJson(missing.x)', expected: null },
    { expr: 'parseJson("   ")', expected: null },
    { expr: 'parseJson(item, "total")', expected: 50 },          // object passthrough
    { expr: 'parseJson(rawJson, "missing.x")', expected: undefined },
    { expr: 'parseJson(rawJson, "user.constructor")', expected: undefined }, // proto gate holds inside parsed JSON
    { expr: 'default(parseJson(badJson), "fb")', expected: 'fb' },
    // SECURITY: prototype access resolves to undefined, never leaks
    { expr: 'weird.constructor', expected: 'SHOULD_NOT_LEAK' }, // own prop is fine
    { expr: 'weird.poisoned', expected: undefined },            // inherited → undefined
    { expr: 'form["constructor"]', expected: undefined },       // inherited on plain obj → undefined
    { expr: 'form.toString', expected: undefined },             // prototype method → undefined
];

// Expressions that MUST throw at parse time (no arbitrary calls / bad grammar).
export const REJECT = [
    'fetch("http://evil")',
    'require("fs")',
    'process.exit(1)',
    'constructor("return 1")()',
    '1 +',
    '(1 + 2',
    'form.',
    'unknownFn(1)',
    '"unterminated',
];
