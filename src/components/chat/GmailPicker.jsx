import { Inbox, Mail } from 'lucide-react';
import React from 'react';
import GoogleWorkspacePickerModal from './GoogleWorkspacePickerModal';
import { formatRelativeDate } from '../../utils/dateFormatters';

// Gmail icon
const GmailIcon = ({ className = "w-6 h-6" }) => (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" fill="#EA4335" />
    </svg>
);

const formatFrom = (from) => {
    if (!from) return '';
    // "Name <email>" → "Name"
    const match = from.match(/^"?([^"<]+)"?\s*</);
    return match ? match[1].trim() : from.split('@')[0];
};

// Gmail-flavoured config wrapper around the shared Google Workspace picker.
const GmailPicker = ({ isOpen, onClose, onFilesSelected, apiBase = '' }) => {
    const exportMessage = async (msgId) => {
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

        return {
            name: `Email: ${data.subject}`,
            type: 'text/plain',
            size: emailText.length,
            content: emailText,
            source: 'gmail',
            gmailMessageId: data.id,
        };
    };

    const renderMessage = (msg) => (
        <>
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
                        {formatRelativeDate(msg.date, { todayShowsTime: true })}
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
        </>
    );

    return (
        <GoogleWorkspacePickerModal
            isOpen={isOpen}
            onClose={onClose}
            onFilesSelected={onFilesSelected}
            apiBase={apiBase}
            statusPath="/api/integrations/gmail/status"
            listPath="/api/integrations/gmail/messages"
            listKey="messages"
            loadErrorMessage="Failed to load messages"
            authWindowName="gmail-auth"
            exportItem={exportMessage}
            title="Gmail"
            icon={GmailIcon}
            accentColor="#EA4335"
            selectedBackground="#fce8e6"
            searchFocusRingClass="focus:ring-red-400"
            searchPlaceholder="Search in Gmail"
            connectTitle="Connect Gmail"
            connectDescription="Sign in with your Google account to browse and attach emails as context."
            emptyIcon={Inbox}
            emptyText="No emails"
            emptySearchText="No emails found"
            itemNoun="email"
            exportingLabel="Loading..."
            renderItem={renderMessage}
        />
    );
};

export default GmailPicker;
