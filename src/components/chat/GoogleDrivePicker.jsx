import React, { useState, useEffect, useCallback } from 'react';
import { X, Search, RefreshCw, Check, ExternalLink } from 'lucide-react';

// Official Google Drive triangle logo
const GoogleDriveIcon = ({ className = "w-6 h-6" }) => (
    <svg className={className} viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
        <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da" />
        <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-20.4 35.3c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47" />
        <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.5l5.85 13.8z" fill="#ea4335" />
        <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d" />
        <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc" />
        <path d="m73.4 26.5-10.1-17.5c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 23.5h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00" />
    </svg>
);

// Google Docs icon (blue document)
const GoogleDocsIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M6 2C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2H6Z" fill="#4285F4" />
        <path d="M14 2V8H20L14 2Z" fill="#A1C2FA" />
        <path d="M8 13H16V14.5H8V13ZM8 16H13V17.5H8V16ZM8 10H16V11.5H8V10Z" fill="white" />
    </svg>
);

// Google Sheets icon (green spreadsheet)
const GoogleSheetsIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M6 2C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2H6Z" fill="#0F9D58" />
        <path d="M14 2V8H20L14 2Z" fill="#87CEAC" />
        <path d="M8 10H16V18H8V10Z" fill="white" fillOpacity="0.4" />
        <path d="M8 10H16V11.5H8V10ZM8 13H16V14.5H8V13ZM8 16H16V17.5H8V16ZM12 10V18" stroke="white" strokeWidth="0.5" />
    </svg>
);

// Google Slides icon (yellow presentation)
const GoogleSlidesIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M6 2C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2H6Z" fill="#F4B400" />
        <path d="M14 2V8H20L14 2Z" fill="#F7D77E" />
        <rect x="7" y="10" width="10" height="7" rx="1" fill="white" />
    </svg>
);

const FILE_TYPE_ICONS = {
    'Google Doc': GoogleDocsIcon,
    'Google Sheet': GoogleSheetsIcon,
    'Google Slides': GoogleSlidesIcon,
};

const GoogleDrivePicker = ({ isOpen, onClose, onFilesSelected, apiBase = '' }) => {
    const [status, setStatus] = useState({ connected: false, configured: false, user: null });
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFiles, setSelectedFiles] = useState(new Set());
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState(null);
    const [nextPageToken, setNextPageToken] = useState(null);

    const checkStatus = useCallback(async () => {
        try {
            const res = await fetch(`${apiBase}/api/integrations/gdrive/status`, { credentials: 'include' });
            const data = await res.json();
            setStatus(data);
            return data;
        } catch (err) {
            console.error('Drive status check failed:', err);
            return { connected: false, configured: false };
        }
    }, [apiBase]);

    const loadFiles = useCallback(async (query = '', append = false) => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (query) params.set('query', query);
            if (append && nextPageToken) params.set('pageToken', nextPageToken);
            params.set('pageSize', '20');

            const res = await fetch(`${apiBase}/api/integrations/gdrive/files?${params}`, { credentials: 'include' });
            if (!res.ok) {
                const err = await res.json();
                if (err.code === 'NOT_CONNECTED') {
                    setStatus(prev => ({ ...prev, connected: false }));
                    return;
                }
                throw new Error(err.error || 'Failed to load files');
            }
            const data = await res.json();
            setFiles(prev => append ? [...prev, ...data.files] : data.files);
            setNextPageToken(data.nextPageToken);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [apiBase, nextPageToken]);

    useEffect(() => {
        if (isOpen) {
            checkStatus().then(s => {
                if (s.connected) loadFiles();
            });
            setSelectedFiles(new Set());
            setSearchQuery('');
        }
    }, [isOpen]);

    useEffect(() => {
        if (!status.connected || !isOpen) return;
        const timer = setTimeout(() => {
            loadFiles(searchQuery);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery, status.connected]);

    const toggleFile = (fileId) => {
        setSelectedFiles(prev => {
            const next = new Set(prev);
            if (next.has(fileId)) next.delete(fileId);
            else next.add(fileId);
            return next;
        });
    };

    const handleAttach = async () => {
        if (selectedFiles.size === 0) return;
        setExporting(true);
        setError(null);

        try {
            const results = [];
            for (const fileId of selectedFiles) {
                const file = files.find(f => f.id === fileId);
                const res = await fetch(`${apiBase}/api/integrations/gdrive/export/${fileId}`, { credentials: 'include' });
                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(`Failed to export ${file?.name || fileId}: ${err.error}`);
                }
                const data = await res.json();
                results.push({
                    name: `${data.name} (${data.type})`,
                    type: 'text/plain',
                    size: data.charCount,
                    content: data.content,
                    source: 'google-drive',
                    driveFileId: data.id,
                });
            }
            onFilesSelected(results);
            onClose();
        } catch (err) {
            setError(err.message);
        } finally {
            setExporting(false);
        }
    };

    const handleConnect = () => {
        const width = 500, height = 600;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        const popup = window.open(
            `${apiBase}/auth/login/google`,
            'google-drive-auth',
            `width=${width},height=${height},left=${left},top=${top}`
        );

        const interval = setInterval(() => {
            if (popup?.closed) {
                clearInterval(interval);
                checkStatus().then(s => {
                    if (s.connected) loadFiles();
                });
            }
        }, 500);
    };

    if (!isOpen) return null;

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const now = new Date();
        const diffMs = now - d;
        const diffDays = Math.floor(diffMs / 86400000);
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays}d ago`;
        return d.toLocaleDateString();
    };

    const FileIcon = ({ type }) => {
        const IconComponent = FILE_TYPE_ICONS[type];
        if (IconComponent) return <IconComponent />;
        return <GoogleDocsIcon />;
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center" onClick={onClose}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
            <div
                className="relative rounded-xl shadow-2xl overflow-hidden"
                style={{
                    width: '560px',
                    maxHeight: '620px',
                    display: 'flex',
                    flexDirection: 'column',
                    background: '#fff',
                    fontFamily: "'Google Sans', 'Segoe UI', Roboto, sans-serif",
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header — Google Drive style */}
                <div className="flex items-center justify-between px-5 py-3.5"
                    style={{ borderBottom: '1px solid #e0e0e0' }}>
                    <div className="flex items-center gap-3">
                        <GoogleDriveIcon className="w-7 h-7" />
                        <div>
                            <h2 className="text-[17px] font-medium" style={{ color: '#202124' }}>
                                Google Drive
                            </h2>
                            {status.connected && status.user && (
                                <span className="text-xs" style={{ color: '#5f6368' }}>
                                    {status.user.email || status.user.displayName}
                                </span>
                            )}
                        </div>
                    </div>
                    <button onClick={onClose}
                        className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                        style={{ color: '#5f6368' }}>
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Not Connected */}
                {!status.connected && (
                    <div className="flex-1 flex flex-col items-center justify-center p-10 gap-5">
                        <GoogleDriveIcon className="w-20 h-20" />
                        <div className="text-center">
                            <h3 className="text-lg font-medium mb-1" style={{ color: '#202124' }}>
                                Connect Google Drive
                            </h3>
                            <p className="text-sm" style={{ color: '#5f6368', maxWidth: '320px' }}>
                                Sign in with your Google account to browse and attach Docs, Sheets, and Slides.
                            </p>
                        </div>
                        {!status.configured ? (
                            <p className="text-xs px-6 text-center" style={{ color: '#d93025' }}>
                                Google SSO is not configured. Ask your admin to set it up in Security settings.
                            </p>
                        ) : (
                            <button
                                onClick={handleConnect}
                                className="flex items-center gap-3 px-6 py-2.5 rounded-md text-sm font-medium transition-all hover:shadow-md"
                                style={{
                                    background: '#fff',
                                    border: '1px solid #dadce0',
                                    color: '#3c4043',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                                }}
                            >
                                <svg className="w-5 h-5" viewBox="0 0 24 24">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                </svg>
                                Sign in with Google
                            </button>
                        )}
                    </div>
                )}

                {/* Connected — File Browser */}
                {status.connected && (
                    <>
                        {/* Search bar — Google style */}
                        <div className="px-4 py-3" style={{ borderBottom: '1px solid #e0e0e0', background: '#f8f9fa' }}>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#9aa0a6' }} />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="Search in Drive"
                                    className="w-full pl-10 pr-4 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                    style={{
                                        background: '#fff',
                                        border: '1px solid #dfe1e5',
                                        color: '#202124',
                                        fontSize: '14px',
                                    }}
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="mx-4 mt-3 p-3 rounded-lg text-xs font-medium"
                                style={{ background: '#fce8e6', color: '#d93025' }}>
                                {error}
                            </div>
                        )}

                        {/* File List */}
                        <div className="flex-1 overflow-y-auto" style={{ minHeight: '300px', maxHeight: '400px' }}>
                            {loading && files.length === 0 ? (
                                <div className="flex items-center justify-center h-full">
                                    <RefreshCw className="w-6 h-6 animate-spin" style={{ color: '#1a73e8' }} />
                                </div>
                            ) : files.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full gap-2" style={{ color: '#5f6368' }}>
                                    <GoogleDriveIcon className="w-12 h-12 opacity-40" />
                                    <span className="text-sm">{searchQuery ? 'No files found' : 'No Google Workspace files'}</span>
                                </div>
                            ) : (
                                <div className="py-1">
                                    {files.map(file => {
                                        const isSelected = selectedFiles.has(file.id);
                                        return (
                                            <button
                                                key={file.id}
                                                onClick={() => toggleFile(file.id)}
                                                className="w-full flex items-center gap-4 px-5 py-2.5 text-left transition-colors"
                                                style={{
                                                    background: isSelected ? '#e8f0fe' : 'transparent',
                                                    borderLeft: isSelected ? '3px solid #1a73e8' : '3px solid transparent',
                                                }}
                                                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f5f5f5'; }}
                                                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                                            >
                                                {/* File type icon */}
                                                <div className="flex-shrink-0">
                                                    <FileIcon type={file.type} />
                                                </div>

                                                {/* File info */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-medium truncate" style={{ color: '#202124' }}>
                                                        {file.name}
                                                    </div>
                                                    <div className="text-xs flex items-center gap-1.5 mt-0.5" style={{ color: '#5f6368' }}>
                                                        <span>{file.type}</span>
                                                        <span>·</span>
                                                        <span>{formatDate(file.modifiedTime)}</span>
                                                        {file.owner && (
                                                            <>
                                                                <span>·</span>
                                                                <span>{file.owner}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Selection indicator */}
                                                {isSelected && (
                                                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                                                        style={{ background: '#1a73e8' }}>
                                                        <Check className="w-3 h-3 text-white" strokeWidth={3} />
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}

                                    {nextPageToken && (
                                        <button
                                            onClick={() => loadFiles(searchQuery, true)}
                                            disabled={loading}
                                            className="w-full py-3 text-sm font-medium transition-colors hover:bg-gray-50"
                                            style={{ color: '#1a73e8' }}
                                        >
                                            {loading ? 'Loading...' : 'Show more files'}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Footer — Google style action bar */}
                        <div className="flex items-center justify-between px-5 py-3"
                            style={{ borderTop: '1px solid #e0e0e0', background: '#f8f9fa' }}>
                            <span className="text-xs" style={{ color: '#5f6368' }}>
                                {selectedFiles.size > 0
                                    ? `${selectedFiles.size} file${selectedFiles.size > 1 ? 's' : ''} selected`
                                    : 'Select files to attach'}
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={onClose}
                                    className="px-4 py-2 rounded text-sm font-medium transition-colors hover:bg-gray-200"
                                    style={{ color: '#5f6368' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAttach}
                                    disabled={selectedFiles.size === 0 || exporting}
                                    className="px-5 py-2 rounded text-sm font-medium text-white transition-all disabled:opacity-40"
                                    style={{
                                        background: selectedFiles.size > 0 ? '#1a73e8' : '#94a3b8',
                                    }}
                                >
                                    {exporting ? 'Exporting...' : 'Attach'}
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default GoogleDrivePicker;
