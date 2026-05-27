import { lazy as reactLazy } from 'react';

// After a redeploy, browsers that loaded the old index.html still hold
// references to the previous hashed chunk filenames (e.g. WorkspaceNotebook-
// CTWJba6H.js). When React.lazy() finally triggers the import, the file is
// gone from the CDN and the user sees a blank Suspense boundary plus a
// "Failed to fetch dynamically imported module" error in the console.
//
// `lazy` here is a drop-in replacement for React.lazy that:
//   1. retries the import once on the next tick (covers transient network
//      blips that are NOT a redeploy),
//   2. if the retry also fails with a chunk-load error, hard-reloads the
//      page once so the browser pulls the new index.html (with current
//      hashes) and tries again from a clean slate,
//   3. uses sessionStorage to break out of any reload loop — if the same
//      chunk fails twice in a single tab, we re-throw so the error boundary
//      can show a real message instead of reloading forever.
const RELOAD_FLAG = 'beeflow-chunk-reload';

const isChunkLoadError = (err) => {
    const msg = String(err?.message || err);
    return /Failed to fetch dynamically imported module|Loading chunk|Loading CSS chunk|Importing a module script failed|error loading dynamically imported module/i.test(msg);
};

export function lazy(importer) {
    return reactLazy(async () => {
        try {
            const mod = await importer();
            try { sessionStorage.removeItem(RELOAD_FLAG); } catch (_) { /* private mode */ }
            return mod;
        } catch (err) {
            if (!isChunkLoadError(err)) throw err;

            // One in-process retry before reaching for the reload hammer.
            try {
                await new Promise(res => setTimeout(res, 250));
                const mod = await importer();
                try { sessionStorage.removeItem(RELOAD_FLAG); } catch (_) { /* ignore */ }
                return mod;
            } catch (retryErr) {
                if (!isChunkLoadError(retryErr)) throw retryErr;

                // Guard against an infinite reload loop on a genuinely broken
                // deploy: if we've already reloaded this tab once, give up.
                let alreadyReloaded = false;
                try { alreadyReloaded = !!sessionStorage.getItem(RELOAD_FLAG); } catch (_) { /* ignore */ }
                if (alreadyReloaded) {
                    try { sessionStorage.removeItem(RELOAD_FLAG); } catch (_) { /* ignore */ }
                    throw retryErr;
                }
                try { sessionStorage.setItem(RELOAD_FLAG, String(Date.now())); } catch (_) { /* ignore */ }
                if (typeof window !== 'undefined') window.location.reload();
                // Hang the Suspense promise so the user sees the existing
                // fallback (not an error flash) while the reload runs.
                return new Promise(() => {});
            }
        }
    });
}
