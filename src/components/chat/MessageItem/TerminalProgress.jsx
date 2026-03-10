import React, { useRef, useEffect } from 'react';
import { Download, FileText } from 'lucide-react';
import { API_BASE } from '../../../utils/helpers';

export default function TerminalProgress({ msg, allMessages }) {
    const terminalRef = useRef(null);
    const prevCmdCount = useRef(0);

    // Auto-scroll terminal when new commands/outputs arrive
    useEffect(() => {
        const ta = msg.terminalActivity;
        const cmdCount = (ta?.commands?.length || 0) + (ta?.outputs?.length || 0);
        if (cmdCount > prevCmdCount.current && terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
        prevCmdCount.current = cmdCount;
    }, [msg.terminalActivity]);

    const ta = msg.terminalActivity;
    if (!ta) return null;

    // Only render the terminal on the LAST message that has terminalActivity.
    if (allMessages && allMessages.length > 0) {
        let foundSelf = false;
        for (const m of allMessages) {
            if (m.id === msg.id) { foundSelf = true; continue; }
            if (foundSelf && m.terminalActivity) {
                return null;
            }
        }
    }

    // Collect ALL terminal entries from every message in the conversation
    const allEntries = [];
    if (allMessages && allMessages.length > 0) {
        for (const m of allMessages) {
            if (m.terminalActivity) {
                const cmds = m.terminalActivity.commands || [];
                const outs = m.terminalActivity.outputs || [];
                const isCurrent = m.id === msg.id;
                cmds.forEach((cmd, i) => {
                    allEntries.push({ cmd, output: outs[i] || null, isCurrent });
                });
            }
        }
    }

    const isRunning = msg.isStreaming;
    const totalCommands = allEntries.length;
    const firstCurrentIdx = allEntries.findIndex(e => e.isCurrent);

    const getCommandDisplay = (cmd) => {
        if (cmd.tool === 'run_command') return cmd.args?.command || '';
        if (cmd.tool === 'python_exec') return `python3 -c "${(cmd.args?.description || cmd.args?.code?.split('\n')[0] || 'script').slice(0, 60)}"`;
        if (cmd.tool === 'pip_install') return `pip install ${cmd.args?.packages || ''}`;
        if (cmd.tool === 'write_file') return `cat > ${cmd.args?.path || 'file'}`;
        if (cmd.tool === 'read_file') return `cat ${cmd.args?.path || 'file'}`;
        return cmd.tool;
    };

    return (
        <div className="mb-3 rounded-xl overflow-hidden shadow-lg" style={{
            border: '1px solid #2a2a2a',
            background: '#1a1a2e'
        }}>
            <div className="flex items-center gap-2 px-3 py-2" style={{
                background: '#16162a',
                borderBottom: '1px solid #2a2a3e'
            }}>
                <div className="flex gap-1.5">
                    <span className="w-3 h-3 rounded-full" style={{ background: '#ff5f57' }}></span>
                    <span className="w-3 h-3 rounded-full" style={{ background: '#febc2e' }}></span>
                    <span className="w-3 h-3 rounded-full" style={{ background: '#28c840' }}></span>
                </div>
                <span className="flex-1 text-center text-[11px] font-medium" style={{ color: '#6b7280' }}>
                    terminal — {totalCommands} command{totalCommands !== 1 ? 's' : ''}
                </span>
                {isRunning && (
                    <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#28c840' }}></span>
                )}
            </div>

            <div
                ref={terminalRef}
                className="overflow-y-auto overflow-x-hidden custom-scrollbar"
                style={{
                    maxHeight: '400px',
                    padding: '12px 14px',
                    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'SF Mono', 'Consolas', monospace",
                    fontSize: '12px',
                    lineHeight: '1.6',
                }}
            >
                {allEntries.map((entry, i) => {
                    const cmdText = getCommandDisplay(entry.cmd);
                    const isLast = i === allEntries.length - 1;
                    const waitingForOutput = !entry.output && isLast && isRunning;
                    const isPrior = !entry.isCurrent;
                    const showSeparator = firstCurrentIdx > 0 && i === firstCurrentIdx;

                    return (
                        <React.Fragment key={i}>
                            {showSeparator && (
                                <div className="my-2 flex items-center gap-2" style={{ color: '#4b5563' }}>
                                    <div className="flex-1" style={{ borderBottom: '1px dashed #374151' }}></div>
                                    <span className="text-[10px] px-2">new session</span>
                                    <div className="flex-1" style={{ borderBottom: '1px dashed #374151' }}></div>
                                </div>
                            )}
                            <div className="mb-2 last:mb-0" style={isPrior ? { opacity: 0.6 } : undefined}>
                                <div className="flex items-start gap-0 flex-wrap">
                                    <span style={{ color: '#28c840', fontWeight: 600 }}>❯ </span>
                                    <span style={{ color: '#e2e8f0', wordBreak: 'break-all' }}>{cmdText}</span>
                                </div>
                                {entry.output && entry.output.content && (
                                    <pre className="whitespace-pre-wrap mt-0.5" style={{
                                        color: entry.output.success ? '#94a3b8' : '#f87171',
                                        margin: 0,
                                        wordBreak: 'break-word',
                                    }}>
                                        {isPrior
                                            ? (entry.output.content.length > 200
                                                ? entry.output.content.slice(0, 200) + '...'
                                                : entry.output.content)
                                            : entry.output.content.slice(0, 3000)}
                                    </pre>
                                )}
                                {entry.output && !entry.output.success && (
                                    <div className="mt-0.5" style={{ color: '#f87171', fontSize: '11px' }}>
                                        ✗ exited with error
                                    </div>
                                )}
                                {waitingForOutput && (
                                    <div className="flex items-center gap-1 mt-1">
                                        <span className="inline-block w-2 h-4 animate-pulse" style={{ background: '#28c840' }}></span>
                                    </div>
                                )}
                            </div>
                        </React.Fragment>
                    );
                })}

                {ta.statusMessage && isRunning && allEntries.length === 0 && (
                    <div style={{ color: '#6b7280' }}>
                        {ta.statusMessage}
                    </div>
                )}
            </div>

            {/* Files section — show downloadable files */}
            {(() => {
                const allFiles = [];
                if (allMessages && allMessages.length > 0) {
                    for (const m of allMessages) {
                        if (m.terminalActivity?.files) {
                            for (const f of m.terminalActivity.files) {
                                if (!allFiles.find(ef => ef.name === f.name)) {
                                    allFiles.push(f);
                                }
                            }
                        }
                    }
                }
                if (allFiles.length === 0) return null;

                const formatSize = (bytes) => {
                    if (bytes < 1024) return `${bytes} B`;
                    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
                    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
                };

                return (
                    <div style={{ borderTop: '1px solid #2a2a3e', padding: '10px 14px', background: '#16162a' }}>
                        <div className="flex items-center gap-1.5 mb-2" style={{ color: '#6b7280', fontSize: '11px' }}>
                            <FileText size={12} />
                            <span>Files ({allFiles.length})</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {allFiles.map((file, i) => (
                                <a
                                    key={i}
                                    href={`${API_BASE}/agents/${file.agentId}/files/download?path=${encodeURIComponent(file.path)}${file.containerKey ? `&conversationId=${encodeURIComponent(file.containerKey)}` : ''}`}
                                    download={file.name}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all"
                                    style={{
                                        background: '#1e1e3a',
                                        border: '1px solid #2a2a4e',
                                        color: '#a5b4fc',
                                        fontSize: '12px',
                                        textDecoration: 'none',
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = '#2a2a4e';
                                        e.currentTarget.style.borderColor = '#4338ca';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = '#1e1e3a';
                                        e.currentTarget.style.borderColor = '#2a2a4e';
                                    }}>
                                    <Download size={13} />
                                    <span>{file.name}</span>
                                    <span style={{ color: '#4b5563', fontSize: '10px' }}>{formatSize(file.size)}</span>
                                </a>
                            ))}
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
