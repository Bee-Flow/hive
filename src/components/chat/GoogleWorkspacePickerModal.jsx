// Shared modal shell for the Google Workspace attachment pickers. Replaces
// the near-identical ~250-line modal JSX that was duplicated between
// GmailPicker and GoogleDrivePicker: connect prompt (Google sign-in button),
// debounced search box, paginated multi-select list, and Cancel/Attach
// footer. Only the item row differs per picker and is injected via the
// `renderItem` render-prop; endpoints and branding come in as props (see
// useGoogleWorkspacePicker for the state/API half).

import { Check, RefreshCw, Search, X } from 'lucide-react';
import React, { useRef } from 'react';
import useGoogleWorkspacePicker from '../../hooks/useGoogleWorkspacePicker';
import useOutsideDismiss from '../../hooks/useOutsideDismiss';

// The multicolour Google "G", shared by both connect prompts.
const GoogleGIcon = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
);

const GoogleWorkspacePickerModal = ({
    isOpen,
    onClose,
    onFilesSelected,
    apiBase = '',
    // API config — forwarded to useGoogleWorkspacePicker
    statusPath,
    listPath,
    listKey,
    loadErrorMessage,
    authWindowName,
    exportItem,
    // Presentation config
    title,
    icon: Icon,
    accentColor,
    selectedBackground,
    searchFocusRingClass,
    searchPlaceholder,
    connectTitle,
    connectDescription,
    emptyIcon: EmptyIcon,
    emptyText,
    emptySearchText,
    itemNoun,
    itemGapClass = 'gap-3',
    exportingLabel = 'Exporting...',
    renderItem,
}) => {
    const {
        status,
        items,
        loading,
        searchQuery,
        setSearchQuery,
        selectedIds,
        toggleItem,
        exporting,
        error,
        nextPageToken,
        loadMore,
        handleAttach,
        handleConnect,
    } = useGoogleWorkspacePicker({
        isOpen,
        onClose,
        onFilesSelected,
        apiBase,
        statusPath,
        listPath,
        listKey,
        loadErrorMessage,
        authWindowName,
        exportItem,
    });

    const panelRef = useRef(null);
    useOutsideDismiss(panelRef, onClose, { enabled: isOpen });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
            <div
                ref={panelRef}
                className="relative rounded-xl shadow-2xl overflow-hidden w-full sm:max-w-[600px]"
                style={{
                    maxHeight: 'min(650px, calc(100vh - 1rem))',
                    display: 'flex',
                    flexDirection: 'column',
                    background: '#fff',
                    fontFamily: "'Google Sans', 'Segoe UI', Roboto, sans-serif",
                }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3.5"
                    style={{ borderBottom: '1px solid #e0e0e0' }}>
                    <div className="flex items-center gap-3">
                        <Icon className="w-7 h-7" />
                        <div>
                            <h2 className="text-[17px] font-medium" style={{ color: '#202124' }}>
                                {title}
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
                        <Icon className="w-20 h-20" />
                        <div className="text-center">
                            <h3 className="text-lg font-medium mb-1" style={{ color: '#202124' }}>
                                {connectTitle}
                            </h3>
                            <p className="text-sm" style={{ color: '#5f6368', maxWidth: '320px' }}>
                                {connectDescription}
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
                                <GoogleGIcon />
                                Sign in with Google
                            </button>
                        )}
                    </div>
                )}

                {/* Connected — Item Browser */}
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
                                    placeholder={searchPlaceholder}
                                    className={`w-full pl-10 pr-4 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 ${searchFocusRingClass} transition-all`}
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

                        {/* Item List */}
                        <div className="flex-1 overflow-y-auto" style={{ minHeight: '300px', maxHeight: '420px' }}>
                            {loading && items.length === 0 ? (
                                <div className="flex items-center justify-center h-full">
                                    <RefreshCw className="w-6 h-6 animate-spin" style={{ color: accentColor }} />
                                </div>
                            ) : items.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full gap-2" style={{ color: '#5f6368' }}>
                                    <EmptyIcon className="w-12 h-12 opacity-40" />
                                    <span className="text-sm">{searchQuery ? emptySearchText : emptyText}</span>
                                </div>
                            ) : (
                                <div className="py-1">
                                    {items.map(item => {
                                        const isSelected = selectedIds.has(item.id);
                                        return (
                                            <button
                                                key={item.id}
                                                onClick={() => toggleItem(item.id)}
                                                className={`w-full flex items-center ${itemGapClass} px-5 py-2.5 text-left transition-colors`}
                                                style={{
                                                    background: isSelected ? selectedBackground : 'transparent',
                                                    borderLeft: isSelected ? `3px solid ${accentColor}` : '3px solid transparent',
                                                }}
                                                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f5f5f5'; }}
                                                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                                            >
                                                {renderItem(item)}

                                                {/* Selection indicator */}
                                                {isSelected && (
                                                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                                                        style={{ background: accentColor }}>
                                                        <Check className="w-3 h-3 text-white" strokeWidth={3} />
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}

                                    {nextPageToken && (
                                        <button
                                            onClick={loadMore}
                                            disabled={loading}
                                            className="w-full py-3 text-sm font-medium transition-colors hover:bg-gray-50"
                                            style={{ color: accentColor }}
                                        >
                                            {loading ? 'Loading...' : `Show more ${itemNoun}s`}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between px-5 py-3"
                            style={{ borderTop: '1px solid #e0e0e0', background: '#f8f9fa' }}>
                            <span className="text-xs" style={{ color: '#5f6368' }}>
                                {selectedIds.size > 0
                                    ? `${selectedIds.size} ${itemNoun}${selectedIds.size > 1 ? 's' : ''} selected`
                                    : `Select ${itemNoun}s to attach`}
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
                                    disabled={selectedIds.size === 0 || exporting}
                                    className="px-5 py-2 rounded text-sm font-medium text-white transition-all disabled:opacity-40"
                                    style={{
                                        background: selectedIds.size > 0 ? accentColor : '#94a3b8',
                                    }}
                                >
                                    {exporting ? exportingLabel : 'Attach'}
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default GoogleWorkspacePickerModal;
