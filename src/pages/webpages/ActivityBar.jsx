import React from 'react';
import { Files, Database, History } from 'lucide-react';

const ITEMS = [
    { id: 'files',   Icon: Files,    title: 'Files' },
    { id: 'sources', Icon: Database, title: 'Sources' },
    { id: 'history', Icon: History,  title: 'Version history' },
];

export default function ActivityBar({ active, onSelect }) {
    return (
        <div
            className="flex flex-col items-center pt-1 pb-1 shrink-0"
            style={{ width: 48, background: 'var(--vsc-actbar-bg)', borderRight: '1px solid var(--vsc-border)' }}
        >
            {ITEMS.map(({ id, Icon, title }) => {
                const isActive = active === id;
                return (
                    <button
                        key={id}
                        title={title}
                        onClick={() => onSelect(id)}
                        className="flex items-center justify-center w-12 h-12 transition-colors"
                        style={{
                            color: isActive ? 'var(--vsc-actbar-icon-active)' : 'var(--vsc-actbar-icon)',
                            borderLeft: isActive ? '2px solid var(--vsc-statusbar-bg)' : '2px solid transparent',
                            background: 'transparent',
                        }}
                    >
                        <Icon size={22} strokeWidth={isActive ? 1.8 : 1.5} />
                    </button>
                );
            })}
        </div>
    );
}
