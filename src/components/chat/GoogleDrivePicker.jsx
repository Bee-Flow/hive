import React from 'react';
import GoogleWorkspacePickerModal from './GoogleWorkspacePickerModal';
import { formatRelativeDate } from '../../utils/dateFormatters';

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

const FileIcon = ({ type }) => {
    const IconComponent = FILE_TYPE_ICONS[type];
    if (IconComponent) return <IconComponent />;
    return <GoogleDocsIcon />;
};

// Drive-flavoured config wrapper around the shared Google Workspace picker.
const GoogleDrivePicker = ({ isOpen, onClose, onFilesSelected, apiBase = '' }) => {
    const exportFile = async (fileId, file) => {
        const res = await fetch(`${apiBase}/api/integrations/gdrive/export/${fileId}`, { credentials: 'include' });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(`Failed to export ${file?.name || fileId}: ${err.error}`);
        }
        const data = await res.json();
        return {
            name: `${data.name} (${data.type})`,
            type: 'text/plain',
            size: data.charCount,
            content: data.content,
            source: 'google-drive',
            driveFileId: data.id,
        };
    };

    const renderFile = (file) => (
        <>
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
                    <span>{formatRelativeDate(file.modifiedTime)}</span>
                    {file.owner && (
                        <>
                            <span>·</span>
                            <span>{file.owner}</span>
                        </>
                    )}
                </div>
            </div>
        </>
    );

    return (
        <GoogleWorkspacePickerModal
            isOpen={isOpen}
            onClose={onClose}
            onFilesSelected={onFilesSelected}
            apiBase={apiBase}
            statusPath="/api/integrations/gdrive/status"
            listPath="/api/integrations/gdrive/files"
            listKey="files"
            loadErrorMessage="Failed to load files"
            authWindowName="google-drive-auth"
            exportItem={exportFile}
            title="Google Drive"
            icon={GoogleDriveIcon}
            accentColor="#1a73e8"
            selectedBackground="#e8f0fe"
            searchFocusRingClass="focus:ring-blue-500"
            searchPlaceholder="Search in Drive"
            connectTitle="Connect Google Drive"
            connectDescription="Sign in with your Google account to browse and attach Docs, Sheets, and Slides."
            emptyIcon={GoogleDriveIcon}
            emptyText="No Google Workspace files"
            emptySearchText="No files found"
            itemNoun="file"
            itemGapClass="gap-4"
            renderItem={renderFile}
        />
    );
};

export default GoogleDrivePicker;
