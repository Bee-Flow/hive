// App-wide logging shim.
//
// In dev, every level passes straight through to `console`. In prod,
// `debug` is a no-op so verbose tracing doesn't ship to end users; `warn`
// and `error` still log because they correlate with real problems we
// want to see in the browser console + via reportClientError.
//
// Migration target: every existing `console.log(...)` (~106 instances)
// becomes `logger.debug(...)`, every `console.warn` stays as
// `logger.warn`, etc. Done file-by-file in Phase 13.1.

const isProd = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.PROD;

const noop = () => {};

export const logger = {
    debug: isProd ? noop : console.debug.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
};

export default logger;
