import React, { useEffect, useState, useCallback, useRef } from 'react';
import { API_BASE, authFetch } from '../../utils/helpers';
import { useTranslation } from '../../hooks/useTranslation';

const HouseStyleSection = ({ user }) => {
    const { t } = useTranslation();
    const orgId = user?.organizationId;
    const perms = user?.permissions || [];
    const isOrgAdmin = perms.includes('all') || perms.includes('org_admin') || perms.some(p => p.startsWith('admin_'));

    const [styles, setStyles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const fileInputRef = useRef(null);

    const load = useCallback(async () => {
        if (!orgId) return;
        setLoading(true);
        try {
            const res = await authFetch(`${API_BASE}/house-styles/${orgId}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            setStyles(await res.json());
            setError(null);
        } catch (e) {
            console.error('[HouseStyle] load failed', e);
            setError(t ? t('settings.house_style.load_error') : 'Kon kantoorstijlen niet laden.');
        } finally {
            setLoading(false);
        }
    }, [orgId, t]);

    useEffect(() => { load(); }, [load]);

    const upload = async (file) => {
        if (!file || !orgId) return;
        if (!file.name.toLowerCase().endsWith('.docx')) {
            setError('Alleen .docx-bestanden worden ondersteund.');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            setError('Bestand is groter dan 10 MB.');
            return;
        }
        setUploading(true);
        setError(null);
        try {
            const fd = new FormData();
            fd.append('file', file);
            fd.append('name', file.name.replace(/\.docx$/i, ''));
            if (styles.length === 0) fd.append('isDefault', 'true');
            const res = await authFetch(`${API_BASE}/house-styles/${orgId}`, { method: 'POST', body: fd });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || `HTTP ${res.status}`);
            }
            await load();
        } catch (e) {
            console.error('[HouseStyle] upload failed', e);
            setError(e.message || 'Upload mislukt.');
        } finally {
            setUploading(false);
        }
    };

    const onFilePicked = (e) => {
        const file = e.target.files?.[0];
        if (file) upload(file);
        e.target.value = '';
    };

    const onDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) upload(file);
    };

    const setDefault = async (id) => {
        try {
            const res = await authFetch(`${API_BASE}/house-styles/${orgId}/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isDefault: true }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            await load();
        } catch (e) {
            console.error('[HouseStyle] setDefault failed', e);
        }
    };

    const saveEdit = async (id) => {
        try {
            const res = await authFetch(`${API_BASE}/house-styles/${orgId}/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: editName, description: editDescription }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            setEditingId(null);
            await load();
        } catch (e) {
            console.error('[HouseStyle] saveEdit failed', e);
        }
    };

    const remove = async (id, name) => {
        if (!window.confirm(`Kantoorstijl "${name}" verwijderen?`)) return;
        try {
            const res = await authFetch(`${API_BASE}/house-styles/${orgId}/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            await load();
        } catch (e) {
            console.error('[HouseStyle] delete failed', e);
        }
    };

    if (!orgId) {
        return (
            <div className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
                Kantoorstijlen zijn alleen beschikbaar voor accounts die aan een organisatie zijn gekoppeld.
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-[17px] font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Kantoorstijl</h3>
                <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
                    Upload een .docx-template om als kantoorstijl in te stellen. Bij export van een Notebook naar Word wordt deze stijl automatisch toegepast (lettertype, koppen, marges, header/footer).
                </p>
            </div>

            {isOrgAdmin && (
                <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={onDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-xl px-5 py-6 text-center cursor-pointer transition-colors"
                    style={{
                        background: dragOver ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                        border: `2px dashed ${dragOver ? 'var(--accent-primary)' : 'var(--border-default)'}`,
                    }}
                >
                    <input ref={fileInputRef} type="file" accept=".docx" className="hidden" onChange={onFilePicked} />
                    <p className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>
                        {uploading ? 'Uploaden…' : 'Sleep een .docx hierheen of klik om te selecteren'}
                    </p>
                    <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
                        Max 10 MB. Alleen .docx.
                    </p>
                </div>
            )}

            {error && (
                <div className="text-[12px] px-3 py-2 rounded-lg" style={{ background: 'rgba(220,38,38,0.08)', color: '#b91c1c' }}>
                    {error}
                </div>
            )}

            {loading ? (
                <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Laden…</p>
            ) : styles.length === 0 ? (
                <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>Nog geen kantoorstijl ingesteld.</p>
            ) : (
                <ul className="space-y-2">
                    {styles.map(s => (
                        <li key={s.id} className="rounded-xl px-4 py-3" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                            {editingId === s.id ? (
                                <div className="space-y-2">
                                    <input
                                        value={editName}
                                        onChange={e => setEditName(e.target.value)}
                                        placeholder="Naam"
                                        className="w-full px-3 py-2 rounded-lg border outline-none text-[13px]"
                                        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                    />
                                    <input
                                        value={editDescription}
                                        onChange={e => setEditDescription(e.target.value)}
                                        placeholder="Beschrijving (optioneel)"
                                        className="w-full px-3 py-2 rounded-lg border outline-none text-[13px]"
                                        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                    />
                                    <div className="flex gap-2">
                                        <button onClick={() => saveEdit(s.id)} className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-white" style={{ background: 'var(--accent-primary)' }}>Opslaan</button>
                                        <button onClick={() => setEditingId(null)} className="px-3 py-1.5 rounded-lg text-[12px]" style={{ color: 'var(--text-muted)' }}>Annuleer</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-start gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-[13px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>{s.name}</p>
                                            {s.isDefault && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: 'rgba(5,150,105,0.1)', color: '#059669' }}>Standaard</span>
                                            )}
                                        </div>
                                        {s.description && <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{s.description}</p>}
                                        <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
                                            {s.styleMeta?.defaultFont || 'Calibri'} · {s.styleMeta?.defaultFontSize || 11}pt
                                        </p>
                                    </div>
                                    <div className="flex flex-col gap-1 items-end flex-shrink-0">
                                        <a
                                            href={`${API_BASE}/house-styles/${orgId}/${s.id}/source.docx`}
                                            className="text-[11px] underline"
                                            style={{ color: 'var(--accent-primary)' }}
                                            download
                                        >Download</a>
                                        {isOrgAdmin && !s.isDefault && (
                                            <button onClick={() => setDefault(s.id)} className="text-[11px] underline" style={{ color: 'var(--accent-primary)' }}>Standaard maken</button>
                                        )}
                                        {isOrgAdmin && (
                                            <button onClick={() => { setEditingId(s.id); setEditName(s.name); setEditDescription(s.description || ''); }} className="text-[11px] underline" style={{ color: 'var(--text-muted)' }}>Bewerken</button>
                                        )}
                                        {isOrgAdmin && (
                                            <button onClick={() => remove(s.id, s.name)} className="text-[11px] underline" style={{ color: '#b91c1c' }}>Verwijder</button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default HouseStyleSection;
