import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';

/**
 * Bot challenge for the signup form.
 *
 * A pentest created a working organisation and an org-admin user anonymously in
 * a single request, and ran thirty concurrent signups without hitting a single
 * limit. Rate limiting caps that per source address; this caps it per attempt,
 * which is the half an attacker cannot solve by renting more addresses.
 *
 * RENDERS NOTHING UNLESS THE SERVER SAYS SO. The configuration comes from
 * GET /auth/setup-status (`signupCaptcha`), which reports { enabled: false }
 * unless the operator set SIGNUP_CAPTCHA_PROVIDER and SIGNUP_CAPTCHA_SECRET.
 * That default is deliberate: Bee Flow ships self-hosted and air-gapped, and a
 * signup form that hard-depends on reaching Cloudflare would simply be broken
 * on those installs. The server enforces independently — this component only
 * produces the token, it never decides whether one is required.
 *
 * The provider script is third-party, so enabling a provider also means adding
 * its host to `script-src`/`frame-src`/`connect-src` in
 * agent-hub/nginx.conf.template (${CAPTCHA_ORIGIN}). Without that the widget
 * silently fails to load and onError below surfaces it rather than leaving the
 * user staring at an inert form.
 */

const PROVIDERS = {
    turnstile: {
        src: 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',
        global: 'turnstile',
    },
    hcaptcha: {
        src: 'https://js.hcaptcha.com/1/api.js?render=explicit',
        global: 'hcaptcha',
    },
    recaptcha: {
        src: 'https://www.google.com/recaptcha/api.js?render=explicit',
        global: 'grecaptcha',
    },
};

/** One <script> per provider per page, however many times this mounts. */
const loaders = new Map();
function loadProviderScript(provider) {
    if (loaders.has(provider)) return loaders.get(provider);
    const spec = PROVIDERS[provider];
    const promise = new Promise((resolve, reject) => {
        if (window[spec.global]) return resolve(window[spec.global]);
        const el = document.createElement('script');
        el.src = spec.src;
        el.async = true;
        el.defer = true;
        el.onload = () => {
            // reCAPTCHA's global is not usable the instant onload fires.
            const ready = window[spec.global];
            if (ready?.ready) ready.ready(() => resolve(ready));
            else resolve(ready);
        };
        el.onerror = () => reject(new Error(`Could not load the ${provider} challenge`));
        document.head.appendChild(el);
    });
    loaders.set(provider, promise);
    return promise;
}

const CaptchaWidget = ({ config, onToken }) => {
    const { t } = useTranslation();
    const containerRef = useRef(null);
    const widgetIdRef = useRef(null);
    const [failed, setFailed] = useState(false);

    // Held in a ref so the widget is rendered exactly once. Re-running the
    // effect because the parent happened to re-create its callback would tear
    // down and re-mount the challenge, discarding a token the user already
    // solved for.
    const onTokenRef = useRef(onToken);
    useEffect(() => { onTokenRef.current = onToken; });

    const enabled = !!config?.enabled && !!PROVIDERS[config.provider] && !!config.siteKey;

    useEffect(() => {
        if (!enabled) return undefined;
        let cancelled = false;

        loadProviderScript(config.provider)
            .then((api) => {
                if (cancelled || !containerRef.current || !api?.render) return;
                // Guard against React 18 StrictMode's double effect run.
                if (widgetIdRef.current !== null) return;
                widgetIdRef.current = api.render(containerRef.current, {
                    sitekey: config.siteKey,
                    callback: (token) => onTokenRef.current?.(token),
                    'expired-callback': () => onTokenRef.current?.(''),
                    'error-callback': () => onTokenRef.current?.(''),
                });
            })
            .catch(() => { if (!cancelled) setFailed(true); });

        return () => {
            cancelled = true;
            const api = window[PROVIDERS[config.provider]?.global];
            if (api?.remove && widgetIdRef.current !== null) {
                try { api.remove(widgetIdRef.current); } catch (_) { /* already gone */ }
            }
            widgetIdRef.current = null;
        };
    }, [enabled, config?.provider, config?.siteKey]);

    if (!enabled) return null;

    if (failed) {
        return (
            <p className="text-xs" style={{ color: 'var(--text-danger, #dc2626)' }}>
                {t('signup.captcha_unavailable', 'The verification challenge could not be loaded. Please refresh the page and try again.')}
            </p>
        );
    }

    return <div ref={containerRef} className="flex justify-center" />;
};

export default CaptchaWidget;
