
import React, { useState, useEffect } from 'react';
import PageRenderer from '../components/PageRenderer';
import { API_BASE, authFetch } from '../utils/helpers';

const ReportsDashboard = ({ onBack }) => {
    const [reportTypes, setReportTypes] = useState([]);
    const [selectedType, setSelectedType] = useState(null);
    const [reportData, setReportData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [filters, setFilters] = useState({
        startDate: '', // YYYY-MM-DD
        endDate: ''   // YYYY-MM-DD
    });

    useEffect(() => {
        fetchReportTypes();
    }, []);

    useEffect(() => {
        if (selectedType) {
            fetchReport(selectedType.id);
        }
    }, [selectedType, filters.startDate, filters.endDate]);

    const fetchReportTypes = async () => {
        try {
            const res = await authFetch(`${API_BASE}/reports/types`);
            if (!res.ok) throw new Error('Failed to fetch report types');
            const data = await res.json();
            setReportTypes(data);
            if (data.length > 0) {
                setSelectedType(data[0]); // Default to first (System Overview)
            }
        } catch (err) {
            console.error(err);
            setError('Failed to load available reports');
        }
    };

    const fetchReport = async (typeId) => {
        setIsLoading(true);
        setError(null);
        try {
            const query = new URLSearchParams(filters).toString();
            const res = await authFetch(`${API_BASE}/reports/${typeId}?${query}`);
            if (!res.ok) throw new Error('Failed to generate report');
            const data = await res.json();
            setReportData(data);
        } catch (err) {
            console.error(err);
            setError('Failed to load report data');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[var(--bg-primary)] text-[var(--text-primary)] animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="p-2 -ml-2 rounded-lg hover:bg-white/5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </button>
                    <div>
                        <h1 className="text-xl font-semibold">System Reports</h1>
                        <p className="text-sm text-[var(--text-muted)]">View system statistics and agent performance</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <select
                        value={selectedType?.id || ''}
                        onChange={(e) => {
                            const type = reportTypes.find(t => t.id === e.target.value);
                            setSelectedType(type);
                        }}
                        className="px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] min-w-[200px]"
                    >
                        {reportTypes.map(type => (
                            <option key={type.id} value={type.id}>{type.name}</option>
                        ))}
                    </select>

                    <button
                        onClick={() => window.print()}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-default)] hover:bg-white/5 transition-colors text-sm"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                        Export
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-8">
                <div className="max-w-5xl mx-auto space-y-6">
                    {/* Filters */}
                    {selectedType?.filters && (
                        <div className="flex flex-wrap gap-4 p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
                            {selectedType.filters.map(filter => {
                                if (filter.type === 'date-range') {
                                    return (
                                        <div key={filter.id} className="flex items-center gap-3">
                                            <span className="text-sm font-medium text-[var(--text-muted)]">{filter.label}:</span>
                                            <input
                                                type="date"
                                                value={filters.startDate}
                                                onChange={e => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                                                className="px-3 py-1.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] placeholder-[var(--text-muted)]"
                                            />
                                            <span className="text-[var(--text-muted)]">to</span>
                                            <input
                                                type="date"
                                                value={filters.endDate}
                                                onChange={e => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                                                className="px-3 py-1.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] placeholder-[var(--text-muted)]"
                                            />
                                            {(filters.startDate || filters.endDate) && (
                                                <button
                                                    onClick={() => setFilters({ startDate: '', endDate: '' })}
                                                    className="p-1 px-2 text-xs rounded hover:bg-white/5 text-[var(--text-muted)] transition-colors"
                                                >
                                                    Clear
                                                </button>
                                            )}
                                        </div>
                                    );
                                }
                                return null;
                            })}
                        </div>
                    )}

                    {/* Description Card */}
                    {selectedType && (
                        <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                            <h3 className="font-medium mb-1">{selectedType.name}</h3>
                            <p className="text-sm text-[var(--text-muted)]">{selectedType.description}</p>
                        </div>
                    )}

                    {error && (
                        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
                            {error}
                        </div>
                    )}

                    {isLoading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="flex flex-col items-center gap-3 text-[var(--text-muted)]">
                                <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                                </svg>
                                <span>Generating report...</span>
                            </div>
                        </div>
                    ) : reportData ? (
                        <div className="report-content print:text-black">
                            <PageRenderer page={reportData} />
                        </div>
                    ) : null}
                </div>
            </div>

            <style>{`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    .report-content, .report-content * {
                        visibility: visible;
                    }
                    .report-content {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        color: black !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default ReportsDashboard;
