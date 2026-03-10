import React, { useState, useEffect, useCallback } from 'react';
import { X, Search, RefreshCw, Check, Mail, Inbox, Star } from 'lucide-react';

// Gmail icon
const GmailIcon = ({ className = "w-6 h-6" }) => (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" fill="#EA4335" />
    </svg>
);

const GmailPicker = ({ isOpen, onClose, onFilesSelected, apiBase = '' }) => {
    const [status, setStatus] = useState({ connected: false, configured: false, user: null });
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedMessages, setSelectedMessages] = useState(new Set());
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState(null);
    const [nextPageToken, setNextPageToken] = useState(null);

    const checkStatus = useCallback(async () => {
        try {
            const res = await fetch(`${apiBase}/api/integrations/gmail/status`, { credentials: 'include' });
            const data = await res.json();
            setStatus(data);
            return data;
        } catch (err) {
            console.error('Gmail status check failed:', err);
            return { connected: false, configured: false };
        }
    }, [apiBase]);

    const loadMessages = useCallback(async (query = '', append = false) => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (query) params.set('query', query);
            if (append && nextPageToken) params.set('pageToken', nextPageToken);
            params.set('pageSize', '20');

            const res = await fetch(`${apiBase}/api/integrations/gmail/messages?${params}`, { credentials: 'include' });
            if (!res.ok) {
                const err = await res.json();
                if (err.code === 'NOT_CONNECTED') {
                    setStatus(prev => ({ ...prev, connected: false }));
                    return;
                }
                throw new Error(err.error || 'Failed to load messages');
            }
            const data = await res.json();
            setMessages(prev => append ? [...prev, ...data.messages] : data.messages);
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
                if (s.connected) loadMessages();
            });
            setSelectedMessages(new Set());
            setSearchQuery('');
        }
    }, [isOpen]);

    useEffect(() => {
        if (!status.connected || !isOpen) return;
        const timer = setTimeout(() => {
            loadMessages(searchQuery);
        }, 400);
        return () => clearTimeout(timer);
    }, [searchQuery, status.connected]);

    const toggleMessage = (msgId) => {
        setSelectedMessages(prev => {
            const next = new Set(prev);
            if (next.has(msgId)) next.delete(msgId);
            else next.add(msgId);
            return next;
        });
    };

    const handleAttach = async () => {
        if (selectedMessages.size === 0) return;
        setExporting(true);
        setError(null);

        try {
            const results = [];
            for (const msgId of selectedMessages) {
                const msg = messages.find(m => m.id === msgId);
                const res = await fetch(`${apiBase}/api/integrations/gmail/messages/${msgId}`, { credentials: 'include' });
                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(`Failed to load email: ${err.error}`);
                }
                const data = await res.json();

                // Format email as readable text
                const emailText = [
                    `From: ${data.from}`,
                    `To: ${data.to}`,
                    `Subject: ${data.subject}`,
                    `Date: ${data.date}`,
                    '',
                    data.body
                ].join('\n');

                results.push({
                    name: `Email: ${data.subject}`,
                    type: 'text/plain',
                    size: emailText.length,
                    content: emailText,
                    source: 'gmail',
                    gmailMessageId: data.id,
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
            'gmail-auth',
            `width=${width},height=${height},left=${left},top=${top}`
        );

        const interval = setInterval(() => {
            if (popup?.closed) {
                clearInterval(interval);
                checkStatus().then(s => {
                    if (s.connected) loadMessages();
                });
            }
        }, 500);
    };

    if (!isOpen) return null;

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        try {
            const d = new Date(dateStr);
            const now = new Date();
            const diffMs = now - d;
            const diffDays = Math.floor(diffMs / 86400000);
            if (diffDays === 0) {
                return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
            if (diffDays === 1) return 'Yesterday';
            if (diffDays < 7) return `${diffDays}d ago`;
            return d.toLocaleDateString();
        } catch {
            return dateStr;
        }
    };

    const formatFrom = (from) => {
        if (!from) return '';
        // "Name <email>" → "Name"
        const match = from.match(/^"?([^"<]+)"?\s*</);
        return match ? match[1].trim() : from.split('@')[0];
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center" onClick={onClose}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
            <div
                className="relative rounded-xl shadow-2xl overflow-hidden"
                style={{
                    width: '600px',
                    maxHeight: '650px',
                    display: 'flex',
                    flexDirection: 'column',
                    background: '#fff',
                    fontFamily: "'Google Sans', 'Segoe UI', Roboto, sans-serif",
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3.5"
                    style={{ borderBottom: '1px solid #e0e0e0' }}>
                    <div className="flex items-center gap-3">
                        <GmailIcon className="w-7 h-7" />
                        <div>
                            <h2 className="text-[17px] font-medium" style={{ color: '#202124' }}>
                                Gmail
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
                        <GmailIcon className="w-20 h-20" />
                        <div className="text-center">
                            <h3 className="text-lg font-medium mb-1" style={{ color: '#202124' }}>
                                Connect Gmail
                            </h3>
                            <p className="text-sm" style={{ color: '#5f6368', maxWidth: '320px' }}>
                                Sign in with your Google account to browse and attach emails as context.
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

                {/* Connected — Email Browser */}
                {status.connected && (
                    <>
                        {/* Search bar */}
                        <div className="px-4 py-3" style={{ borderBottom: '1px solid #e0e0e0', background: '#f8f9fa' }}>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#9aa0a6' }} />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="Search in Gmail"
                                    className="w-full pl-10 pr-4 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400 transition-all"
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

                        {/* Message List */}
                        <div className="flex-1 overflow-y-auto" style={{ minHeight: '300px', maxHeight: '420px' }}>
                            {loading && messages.length === 0 ? (
                                <div className="flex items-center justify-center h-full">
                                    <RefreshCw className="w-6 h-6 animate-spin" style={{ color: '#EA4335' }} />
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full gap-2" style={{ color: '#5f6368' }}>
                                    <Inbox className="w-12 h-12 opacity-40" />
                                    <span className="text-sm">{searchQuery ? 'No emails found' : 'No emails'}</span>
                                </div>
                            ) : (
                                <div className="py-1">
                                    {messages.map(msg => {
                                        const isSelected = selectedMessages.has(msg.id);
                                        return (
                                            <button
                                                key={msg.id}
                                                onClick={() => toggleMessage(msg.id)}
                                                className="w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors"
                                                style={{
                                                    background: isSelected ? '#fce8e6' : 'transparent',
                                                    borderLeft: isSelected ? '3px solid #EA4335' : '3px solid transparent',
                                                }}
                                                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f5f5f5'; }}
                                                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                                            >
                                                {/* Mail icon */}
                                                <div className="flex-shrink-0">
                                                    <Mail className="w-5 h-5" style={{ color: msg.isUnread ? '#EA4335' : '#9aa0a6' }} />
                                                </div>

                                                {/* Email info */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className={`text-sm truncate ${msg.isUnread ? 'font-semibold' : 'font-medium'}`}
                                                            style={{ color: '#202124', maxWidth: '200px' }}>
                                                            {formatFrom(msg.from)}
                                                        </span>
                                                        <span className="text-xs flex-shrink-0" style={{ color: '#5f6368' }}>
                                                            {formatDate(msg.date)}
                                                        </span>
                                                    </div>
                                                    <div className={`text-sm truncate ${msg.isUnread ? 'font-semibold' : ''}`}
                                                        style={{ color: '#202124' }}>
                                                        {msg.subject}
                                                    </div>
                                                    <div className="text-xs truncate mt-0.5" style={{ color: '#5f6368' }}>
                                                        {msg.snippet}
                                                    </div>
                                                </div>

                                                {/* Selection indicator */}
                                                {isSelected && (
                                                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                                                        style={{ background: '#EA4335' }}>
                                                        <Check className="w-3 h-3 text-white" strokeWidth={3} />
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}

                                    {nextPageToken && (
                                        <button
                                            onClick={() => loadMessages(searchQuery, true)}
                                            disabled={loading}
                                            className="w-full py-3 text-sm font-medium transition-colors hover:bg-gray-50"
                                            style={{ color: '#EA4335' }}
                                        >
                                            {loading ? 'Loading...' : 'Show more emails'}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between px-5 py-3"
                            style={{ borderTop: '1px solid #e0e0e0', background: '#f8f9fa' }}>
                            <span className="text-xs" style={{ color: '#5f6368' }}>
                                {selectedMessages.size > 0
                                    ? `${selectedMessages.size} email${selectedMessages.size > 1 ? 's' : ''} selected`
                                    : 'Select emails to attach'}
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
                                    disabled={selectedMessages.size === 0 || exporting}
                                    className="px-5 py-2 rounded text-sm font-medium text-white transition-all disabled:opacity-40"
                                    style={{
                                        background: selectedMessages.size > 0 ? '#EA4335' : '#94a3b8',
                                    }}
                                >
                                    {exporting ? 'Loading...' : 'Attach'}
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default GmailPicker;
