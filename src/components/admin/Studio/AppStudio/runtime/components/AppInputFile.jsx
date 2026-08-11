import { Loader2, Paperclip, X } from 'lucide-react';
import { useState } from 'react';
import { API_BASE, authFetch } from '../../../../../../utils/helpers';
import { useDataContext } from '../DataContext';
import { useFormField } from '../formContext';
import { useRuntime } from '../RuntimeContext';
import { Field } from '../uiBits';

/**
 * App Studio runtime — 'input_file'. Spec: server/appStudio/componentSpecs.js.
 *
 * Uploads to the app's OWN attachment store (POST /api/studio-apps/:id/data/
 * attachments — uploadGuard-validated pdf/word/excel/image set, AV-scanned,
 * quota'd, works for any signed-in viewer; the old CMS uploader was admin-only
 * and images-only). The field value is an attachment DESCRIPTOR
 *   { kind: 'studio_attachment', fileId, name, mime, size }
 * (an array of them when `multiple`) — the shape record writes tolerate and
 * the app-trigger bridge (run_automation → app_trigger routines) verifies and
 * expands server-side. Legacy values that are bare URL strings (the old CMS
 * flow) still render. Uploads only fire in run mode.
 */

function legacyFileName(url) {
    const s = String(url || '');
    try { return decodeURIComponent(s.split('/').pop() || s); } catch { return s; }
}

export function entryName(entry) {
    if (entry && typeof entry === 'object') return entry.name || entry.fileId || 'file';
    return legacyFileName(entry);
}

export function entryHref(entry, appId) {
    if (entry && typeof entry === 'object') {
        return appId ? `${API_BASE}/api/studio-apps/${encodeURIComponent(appId)}/data/attachments/${encodeURIComponent(entry.fileId)}` : null;
    }
    return String(entry || '') || null;
}

// The guard's 409 (quota) / 422 (scan) answers deserve product copy; other
// failures surface the server's own message.
function friendlyUploadError(status, serverMessage) {
    if (status === 409) return "This app's file storage is full — remove old files or ask the owner to clean up.";
    if (status === 422) return 'The file failed a malware scan and was refused.';
    return serverMessage || `Upload failed (${status})`;
}

export default function AppInputFile({ node }) {
    const { mode } = useRuntime();
    const { appId } = useDataContext();
    const { name, label = 'File', accept = null, multiple = false, required = false } = node.props || {};
    const { value, setValue, error } = useFormField({
        name, defaultValue: multiple ? [] : null, required, label,
    });
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState(null);
    const id = `${node.id}-input`;

    const entries = multiple ? (Array.isArray(value) ? value : []) : (value ? [value] : []);
    const canUpload = mode === 'run' && !!appId;

    const handleFiles = async (fileList) => {
        if (!canUpload) return;
        const files = Array.from(fileList || []);
        if (!files.length) return;
        setUploading(true);
        setUploadError(null);
        // Filled as we go and committed in `finally`: a failure halfway through
        // a batch must KEEP the files that already made it to the store.
        const uploaded = [];
        try {
            for (const file of files) {
                const fd = new FormData();
                fd.append('file', file);
                const res = await authFetch(`${API_BASE}/api/studio-apps/${encodeURIComponent(appId)}/data/attachments`, { method: 'POST', body: fd });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(friendlyUploadError(res.status, data.error));
                // The route answers { success, attachment: { id, mime, size, … } };
                // tolerate a flat body too. NEVER swallow a missing id — that
                // silently dropped the file (upload 200'd, nothing listed).
                const att = (data && typeof data.attachment === 'object' && data.attachment) ? data.attachment : data;
                if (!att || !att.id) throw new Error('The file uploaded but the server returned no file id.');
                uploaded.push({
                    kind: 'studio_attachment',
                    fileId: att.id,
                    name: file.name,
                    mime: att.mime || file.type || null,
                    size: att.size ?? file.size ?? null,
                });
            }
        } catch (err) {
            setUploadError(err.message || 'Upload failed.');
        } finally {
            if (uploaded.length) {
                if (multiple) setValue([...entries, ...uploaded]);
                else setValue(uploaded[0]);
            }
            setUploading(false);
        }
    };

    // Dropping the descriptor was the whole of "remove" — the uploaded bytes
    // stayed in the app's store forever, so re-picking a file three times left
    // three dead blobs charging against the quota and the only later symptom was
    // "This app's file storage is full" over an app holding two visible files.
    // The DELETE refuses anything already linked to a record, so this can only
    // ever discard an upload that never landed anywhere.
    const removeAt = (i) => {
        const entry = entries[i];
        if (multiple) setValue(entries.filter((_, j) => j !== i));
        else setValue(null);
        if (!canUpload || !entry || typeof entry !== 'object' || !entry.fileId) return;
        authFetch(
            `${API_BASE}/api/studio-apps/${encodeURIComponent(appId)}/data/attachments/${encodeURIComponent(entry.fileId)}`,
            { method: 'DELETE' },
        ).catch(() => { /* the field is already clear; the sweep can have the bytes */ });
    };

    return (
        <Field id={id} label={label} required={required} error={error || uploadError}>
            <div className="flex flex-col gap-2">
                <label
                    className="relative inline-flex w-fit items-center gap-2 px-3 py-1.5 text-sm cursor-pointer border focus-within:outline focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-[var(--text-secondary)]"
                    style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)', borderRadius: 'var(--app-radius)', color: 'var(--text-primary)', opacity: canUpload || mode !== 'run' ? undefined : 0.6 }}
                >
                    {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <Paperclip className="w-3.5 h-3.5" aria-hidden="true" />}
                    <span>{uploading ? 'Uploading…' : (multiple ? 'Choose files' : 'Choose a file')}</span>
                    <input
                        id={id}
                        name={name}
                        type="file"
                        accept={accept || undefined}
                        multiple={multiple || undefined}
                        aria-required={required || undefined}
                        aria-invalid={error ? true : undefined}
                        aria-describedby={(error || uploadError) ? `${id}-error` : undefined}
                        // NOT `hidden`: display:none takes the input out of the
                        // tab order, and the <label> wrapping it is not
                        // focusable either — so there was no keyboard path to
                        // the upload control at all. Visually hidden, still
                        // focusable, and the label's own focus-within paints
                        // the ring.
                        className="absolute h-px w-px opacity-0"
                        disabled={uploading || !canUpload}
                        // Clearing the control before uploading is what makes
                        // re-picking the SAME file after a removal or a failed
                        // upload fire a change event at all.
                        onChange={(e) => {
                            const picked = Array.from(e.target.files || []);
                            e.target.value = '';
                            handleFiles(picked);
                        }}
                    />
                </label>
                {entries.length ? (
                    <ul className="flex flex-col gap-1">
                        {entries.map((entry, i) => {
                            const href = entryHref(entry, appId);
                            const display = entryName(entry);
                            return (
                                <li
                                    key={`${typeof entry === 'object' ? entry.fileId : entry}-${i}`}
                                    className="flex items-center gap-2 px-2 py-1 text-xs border"
                                    style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)', borderRadius: 'var(--app-radius)' }}
                                >
                                    {href ? (
                                        <a href={href} target="_blank" rel="noopener noreferrer" className="truncate underline underline-offset-2" style={{ color: 'var(--app-primary)' }}>
                                            {display}
                                        </a>
                                    ) : (
                                        <span className="truncate" style={{ color: 'var(--text-primary)' }}>{display}</span>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => removeAt(i)}
                                        aria-label={`Remove ${display}`}
                                        className="ml-auto shrink-0"
                                        style={{ color: 'var(--text-muted)' }}
                                    >
                                        <X className="w-3.5 h-3.5" aria-hidden="true" />
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                ) : null}
            </div>
        </Field>
    );
}
