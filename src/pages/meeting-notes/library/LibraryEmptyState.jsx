import React from 'react';
import { Mic } from 'lucide-react';
import EmptyState from '../../../components/shared/EmptyState';

export default function LibraryEmptyState({ onCapture }) {
    return (
        <EmptyState
            icon={<Mic className="w-14 h-14" />}
            title="No meetings yet"
            description="Record live, upload a file, or send a bot to your next meeting — you'll get a searchable transcript, summary and action items in minutes."
            action={{
                label: 'New transcription',
                onClick: onCapture,
                icon: <Mic className="w-4 h-4" />,
            }}
        />
    );
}
