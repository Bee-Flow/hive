import React, { useState } from 'react';
import { Tag, Plus, Percent, Euro, Hash, Clock, ToggleLeft, ToggleRight } from 'lucide-react';
import { SectionHeader } from '../ui/SectionHeader';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { Spinner } from '../ui/Spinner';
import { useResource, apiJson } from '../hooks/useApi';
import { useToast } from '../ui/Toast';
import { PromoEditor } from './PromoEditor';

export function PromosView() {
    const toast = useToast();
    const { data: codes = [], loading, reload } = useResource('/api/stripe/promo-codes', { initial: [] });
    const [creating, setCreating] = useState(false);

    const toggle = async (code) => {
        const action = code.active ? 'deactivate' : 'activate';
        try {
            await apiJson(`/api/stripe/promo-codes/${code.id}/${action}`, { method: 'PUT' });
            toast.success(`${code.code} ${action}d.`);
            reload();
        } catch (e) {
            toast.error(e.message || `${action} failed`);
        }
    };

    if (creating) {
        return <PromoEditor onBack={() => setCreating(false)} onCreated={() => { setCreating(false); reload(); }} />;
    }

    return (
        <div className="px-6 py-6 max-w-[1100px] mx-auto">
            <SectionHeader
                title="Promotion Codes"
                description="Create and manage discount codes that customers can apply at Stripe checkout."
                action={<Button icon={Plus} onClick={() => setCreating(true)}>New code</Button>}
            />

            {loading ? (
                <Spinner label="Loading promo codes…" />
            ) : codes.length === 0 ? (
                <EmptyState
                    icon={Tag}
                    title="No promotion codes yet"
                    description="Create your first one to start running discount campaigns."
                    action={<Button icon={Plus} onClick={() => setCreating(true)}>Create code</Button>}
                />
            ) : (
                <div className="flex flex-col gap-2">
                    {codes.map(c => (
                        <Card key={c.id} className={`!p-4 flex items-center justify-between gap-4 ${c.active ? '' : 'opacity-60'}`} hover>
                            <div className="flex items-center gap-4 min-w-0 flex-1">
                                <div className={`px-3 py-2 rounded-lg font-mono font-bold text-[14px] tracking-wider whitespace-nowrap ${
                                    c.active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
                                }`}>
                                    {c.code}
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 text-[13.5px] font-semibold text-[var(--text-primary)]">
                                        {c.discountType === 'percent' ? (
                                            <><Percent className="w-3.5 h-3.5 text-blue-400" /> {c.discountValue}% off</>
                                        ) : (
                                            <><Euro className="w-3.5 h-3.5 text-blue-400" /> {(c.discountValue / 100).toFixed(2)} {c.currency?.toUpperCase()} off</>
                                        )}
                                        <span className="font-normal text-[11px] text-[var(--text-muted)]">
                                            · {c.duration === 'once' ? 'one-time' : c.duration === 'forever' ? 'forever' : `${c.durationMonths}mo`}
                                        </span>
                                    </div>
                                    {c.name && <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{c.name}</div>}
                                    <div className="flex items-center flex-wrap gap-3 mt-1 text-[11px] text-[var(--text-muted)]">
                                        <span className="inline-flex items-center gap-1">
                                            <Hash className="w-3 h-3" /> {c.timesRedeemed || 0}{c.maxRedemptions ? `/${c.maxRedemptions}` : ''} used
                                        </span>
                                        {c.expiresAt && (
                                            <span className="inline-flex items-center gap-1">
                                                <Clock className="w-3 h-3" /> expires {new Date(c.expiresAt).toLocaleDateString()}
                                            </span>
                                        )}
                                        {c.firstTimeOnly && <span className="text-amber-400">new customers only</span>}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <Badge tone={c.active ? 'success' : 'danger'} size="sm">
                                    {c.active ? 'Active' : 'Inactive'}
                                </Badge>
                                <Button
                                    size="sm"
                                    variant={c.active ? 'danger' : 'success'}
                                    icon={c.active ? ToggleRight : ToggleLeft}
                                    onClick={() => toggle(c)}
                                >
                                    {c.active ? 'Deactivate' : 'Activate'}
                                </Button>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
