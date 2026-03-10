/**
 * OPAQUE Client Library
 *
 * Wraps @serenity-kit/opaque for the Beeflow authentication flow.
 * Handles registration, login, KEK derivation, and DEK wrapping — all client-side.
 *
 * The server NEVER sees the password/PIN through this flow.
 */

import * as opaque from '@serenity-kit/opaque';

const API_BASE = '/auth/opaque';

// ============================================================
// HELPERS — Client-side crypto using WebCrypto
// ============================================================

/**
 * Derive KEK from OPAQUE exportKey using HKDF.
 * @param {string} exportKey - Base64 exportKey from OPAQUE finishLogin/finishRegistration
 * @returns {Promise<CryptoKey>} AES-256-GCM key for DEK wrapping
 */
async function deriveKEK(exportKey) {
    const keyMaterial = Uint8Array.from(atob(exportKey), c => c.charCodeAt(0));
    const imported = await crypto.subtle.importKey(
        'raw', keyMaterial, { name: 'HKDF' }, false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
        {
            name: 'HKDF',
            hash: 'SHA-256',
            salt: new TextEncoder().encode('beeflow:opaque:kek:v1'),
            info: new TextEncoder().encode('beeflow:opaque:kek-derive')
        },
        imported,
        { name: 'AES-GCM', length: 256 },
        true, // extractable — needed for export
        ['encrypt', 'decrypt']
    );
}

/**
 * Generate a random 32-byte DEK.
 * @returns {Uint8Array}
 */
function generateDEK() {
    return crypto.getRandomValues(new Uint8Array(32));
}

/**
 * Generate a random recovery key (32 bytes, hex-formatted in 8-char groups).
 * @returns {{ raw: Uint8Array, formatted: string }}
 */
function generateRecoveryKey() {
    const raw = crypto.getRandomValues(new Uint8Array(32));
    const hex = Array.from(raw).map(b => b.toString(16).padStart(2, '0')).join('');
    const formatted = hex.match(/.{8}/g).join('-').toUpperCase();
    return { raw, formatted };
}

/**
 * Wrap (encrypt) a DEK with a CryptoKey (KEK or recovery key).
 * @param {Uint8Array} dek - 32-byte DEK
 * @param {CryptoKey} key - AES-256-GCM wrapping key
 * @param {string} context - AAD context string
 * @returns {Promise<{ iv: string, authTag: string, data: string }>}
 */
async function wrapDEK(dek, key, context = 'dek-wrap') {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const aad = new TextEncoder().encode(context);
    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv, additionalData: aad, tagLength: 128 },
        key,
        dek
    );
    // WebCrypto appends the 16-byte auth tag to the ciphertext
    const ct = new Uint8Array(ciphertext);
    const data = ct.slice(0, ct.length - 16);
    const authTag = ct.slice(ct.length - 16);
    return {
        iv: bufToHex(iv),
        authTag: bufToHex(authTag),
        data: bufToHex(data)
    };
}

/**
 * Unwrap (decrypt) a DEK with a CryptoKey.
 * @param {{ iv: string, authTag: string, data: string }} wrapped
 * @param {CryptoKey} key - AES-256-GCM unwrapping key
 * @param {string} context - AAD context (must match wrap)
 * @returns {Promise<Uint8Array>} 32-byte DEK
 */
async function unwrapDEK(wrapped, key, context = 'dek-wrap') {
    const iv = hexToBuf(wrapped.iv);
    const data = hexToBuf(wrapped.data);
    const authTag = hexToBuf(wrapped.authTag);
    const aad = new TextEncoder().encode(context);
    // WebCrypto expects tag appended to ciphertext
    const combined = new Uint8Array(data.length + authTag.length);
    combined.set(data);
    combined.set(authTag, data.length);
    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv, additionalData: aad, tagLength: 128 },
        key,
        combined
    );
    return new Uint8Array(decrypted);
}

/**
 * Import a raw key buffer as an AES-256-GCM CryptoKey.
 * @param {Uint8Array} raw - 32-byte raw key
 * @returns {Promise<CryptoKey>}
 */
async function importAESKey(raw) {
    return crypto.subtle.importKey(
        'raw', raw, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']
    );
}

/**
 * Encrypt the DEK with the OPAQUE session key for sending to server (Option B).
 * @param {Uint8Array} dek - 32-byte DEK
 * @param {string} sessionKey - Base64 session key from OPAQUE
 * @returns {Promise<{ iv: string, authTag: string, data: string }>}
 */
async function encryptDEKForServer(dek, sessionKey) {
    const keyBytes = Uint8Array.from(atob(sessionKey), c => c.charCodeAt(0));
    const aesKey = await crypto.subtle.importKey(
        'raw', keyBytes.slice(0, 32), { name: 'AES-GCM' }, false, ['encrypt']
    );
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const dekB64 = btoa(String.fromCharCode(...dek));
    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv, tagLength: 128 },
        aesKey,
        new TextEncoder().encode(dekB64)
    );
    const ct = new Uint8Array(ciphertext);
    return {
        iv: bufToHex(iv),
        authTag: bufToHex(ct.slice(ct.length - 16)),
        data: bufToHex(ct.slice(0, ct.length - 16))
    };
}

// Hex helpers
function bufToHex(buf) {
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function hexToBuf(hex) {
    return new Uint8Array(hex.match(/.{2}/g).map(b => parseInt(b, 16)));
}

// ============================================================
// OPAQUE FLOWS
// ============================================================

/**
 * Register a new user with OPAQUE.
 * Client generates DEK, wraps it with KEK derived from exportKey.
 *
 * @param {string} username
 * @param {string} password
 * @returns {Promise<{ success: boolean, recoveryKey: string, user: object }>}
 */
export async function opaqueRegister(username, password) {
    await opaque.ready;

    // Step 1: Start registration
    const { clientRegistrationState, registrationRequest } = opaque.client.startRegistration({ password });

    const startRes = await fetch(`${API_BASE}/register/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, registrationRequest })
    });
    if (!startRes.ok) throw new Error((await startRes.json()).error || 'Registration start failed');
    const { registrationResponse } = await startRes.json();

    // Step 2: Finish registration — get exportKey
    const { exportKey, registrationRecord } = opaque.client.finishRegistration({
        clientRegistrationState,
        registrationResponse,
        password
    });

    // Step 3: Client-side key generation
    const kek = await deriveKEK(exportKey);
    const dek = generateDEK();
    const { raw: recoveryRaw, formatted: recoveryKey } = generateRecoveryKey();

    // Wrap DEK with KEK
    const wrappedDEK = await wrapDEK(dek, kek, `dek-wrap:${username}`);

    // Wrap DEK with recovery key
    const recoveryAESKey = await importAESKey(recoveryRaw);
    const recoveryWrappedDEK = await wrapDEK(dek, recoveryAESKey, `recovery-wrap:${username}`);

    // Step 4: Send to server
    const finishRes = await fetch(`${API_BASE}/register/finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
            username,
            registrationRecord,
            wrappedDEK,
            recoveryWrappedDEK
        })
    });
    if (!finishRes.ok) throw new Error((await finishRes.json()).error || 'Registration finish failed');
    const result = await finishRes.json();

    return { ...result, recoveryKey, dek: btoa(String.fromCharCode(...dek)) };
}

/**
 * Login with OPAQUE.
 * Unwraps DEK client-side, optionally sends encrypted DEK to server.
 *
 * @param {string} username
 * @param {string} password
 * @returns {Promise<{ success: boolean, user: object, dek: string }>}
 */
export async function opaqueLogin(username, password) {
    await opaque.ready;

    // Step 1: Start login
    const { clientLoginState, startLoginRequest } = opaque.client.startLogin({ password });

    const startRes = await fetch(`${API_BASE}/login/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, startLoginRequest })
    });
    if (!startRes.ok) {
        const err = await startRes.json();
        if (err.useLegacy) return { useLegacy: true };
        throw new Error(err.error || 'Login start failed');
    }
    const { loginResponse, loginId, wrappedDEK } = await startRes.json();

    // Step 2: Finish login — get exportKey, sessionKey
    const loginResult = opaque.client.finishLogin({
        clientLoginState,
        loginResponse,
        password
    });
    if (!loginResult) throw new Error('Invalid password');
    const { exportKey, finishLoginRequest, sessionKey } = loginResult;

    // Step 3: Derive KEK, unwrap DEK
    const kek = await deriveKEK(exportKey);
    let dek = null;
    if (wrappedDEK) {
        dek = await unwrapDEK(wrappedDEK, kek, `dek-wrap:${username}`);
    }

    // Step 4: Encrypt DEK for server (Option B — server needs it for AI)
    let encryptedDEK = null;
    if (dek) {
        encryptedDEK = await encryptDEKForServer(dek, sessionKey);
    }

    // Step 5: Finish with server
    const finishRes = await fetch(`${API_BASE}/login/finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ loginId, finishLoginRequest, encryptedDEK })
    });
    if (!finishRes.ok) throw new Error((await finishRes.json()).error || 'Login finish failed');
    const result = await finishRes.json();

    return {
        ...result,
        dek: dek ? btoa(String.fromCharCode(...dek)) : null
    };
}

/**
 * Register SSO encryption PIN with OPAQUE.
 * @param {string} pin
 * @param {Uint8Array} [existingDEK] - Optional existing DEK to re-wrap
 * @returns {Promise<{ success: boolean, recoveryKey: string }>}
 */
export async function opaquePinRegister(pin, existingDEK = null) {
    await opaque.ready;

    const { clientRegistrationState, registrationRequest } = opaque.client.startRegistration({ password: pin });

    const startRes = await fetch(`${API_BASE}/pin/register/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ registrationRequest })
    });
    if (!startRes.ok) throw new Error((await startRes.json()).error || 'PIN registration start failed');
    const { registrationResponse } = await startRes.json();

    const { exportKey, registrationRecord } = opaque.client.finishRegistration({
        clientRegistrationState,
        registrationResponse,
        password: pin
    });

    const kek = await deriveKEK(exportKey);
    const dek = existingDEK || generateDEK();
    const { raw: recoveryRaw, formatted: recoveryKey } = generateRecoveryKey();

    const wrappedDEK = await wrapDEK(dek, kek, 'dek-wrap:sso-pin');
    const recoveryAESKey = await importAESKey(recoveryRaw);
    const recoveryWrappedDEK = await wrapDEK(dek, recoveryAESKey, 'recovery-wrap:sso-pin');

    const finishRes = await fetch(`${API_BASE}/pin/register/finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ registrationRecord, wrappedDEK, recoveryWrappedDEK })
    });
    if (!finishRes.ok) throw new Error((await finishRes.json()).error || 'PIN registration finish failed');

    return { success: true, recoveryKey, dek: btoa(String.fromCharCode(...dek)) };
}

/**
 * Login with SSO encryption PIN via OPAQUE.
 * @param {string} pin
 * @returns {Promise<{ success: boolean, dek: string }>}
 */
export async function opaquePinLogin(pin) {
    await opaque.ready;

    const { clientLoginState, startLoginRequest } = opaque.client.startLogin({ password: pin });

    const startRes = await fetch(`${API_BASE}/pin/login/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ startLoginRequest })
    });
    if (!startRes.ok) throw new Error((await startRes.json()).error || 'PIN login start failed');
    const startData = await startRes.json();

    if (startData.needsSetup) return { needsSetup: true };

    const { loginResponse, loginId, wrappedDEK } = startData;

    const loginResult = opaque.client.finishLogin({
        clientLoginState,
        loginResponse,
        password: pin
    });
    if (!loginResult) throw new Error('Invalid PIN');
    const { exportKey, finishLoginRequest, sessionKey } = loginResult;

    const kek = await deriveKEK(exportKey);
    let dek = null;
    if (wrappedDEK) {
        dek = await unwrapDEK(wrappedDEK, kek, 'dek-wrap:sso-pin');
    }

    let encryptedDEK = null;
    if (dek) {
        encryptedDEK = await encryptDEKForServer(dek, sessionKey);
    }

    const finishRes = await fetch(`${API_BASE}/pin/login/finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ loginId, finishLoginRequest, encryptedDEK })
    });
    if (!finishRes.ok) throw new Error((await finishRes.json()).error || 'PIN login finish failed');

    return {
        success: true,
        dek: dek ? btoa(String.fromCharCode(...dek)) : null
    };
}

/**
 * Check the user's OPAQUE status.
 * @returns {Promise<{ kdfMode: string, hasOpaqueRecord: boolean }>}
 */
export async function getOpaqueStatus() {
    const res = await fetch(`${API_BASE}/status`, { credentials: 'include' });
    if (!res.ok) return { kdfMode: 'legacy_argon2', hasOpaqueRecord: false };
    return res.json();
}
