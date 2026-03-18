import React from 'react';
import { Building, MapPin, Phone, FileText, ArrowLeft, ArrowRight } from 'lucide-react';

const SignupStepOrg = ({ signupData, setSignupData, signupOrgs, handleSignupNext, resetSignup, inputClass, inputClassSimple, labelClass }) => {
    return (
        <form onSubmit={e => { e.preventDefault(); handleSignupNext(); }} className="space-y-4">
            {/* New / Join existing toggle — only show when public orgs exist */}
            {signupOrgs.length > 0 && (
                <div style={{
                    display: 'flex', gap: '4px', padding: '3px', borderRadius: '10px',
                    background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', marginBottom: '4px',
                }}>
                    {[
                        { id: 'new', label: 'New Organisation' },
                        { id: 'existing', label: 'Join Existing' },
                    ].map(opt => {
                        const active = signupData.signupType === opt.id;
                        return (
                            <button key={opt.id} type="button"
                                onClick={() => setSignupData(p => ({ ...p, signupType: opt.id }))}
                                style={{
                                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    padding: '8px 12px', borderRadius: '8px', fontSize: '13px',
                                    fontWeight: active ? 600 : 500, border: 'none', cursor: 'pointer',
                                    transition: 'all .15s ease',
                                    background: active ? 'var(--accent-primary)' : 'transparent',
                                    color: active ? '#fff' : 'var(--text-muted)',
                                }}
                            >
                                {opt.label}
                            </button>
                        );
                    })}
                </div>
            )}

            {signupData.signupType === 'new' ? (
                <>
                    <div>
                        <label className={labelClass}>Company Name *</label>
                        <div className="relative">
                            <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-tertiary)]" />
                            <input type="text" value={signupData.newOrgName} onChange={e => setSignupData(p => ({ ...p, newOrgName: e.target.value }))} className={inputClass} placeholder="Acme Corp" required />
                        </div>
                    </div>
                    <div>
                        <label className={labelClass}>Tagline / Slogan</label>
                        <input type="text" value={signupData.orgTagline} onChange={e => setSignupData(p => ({ ...p, orgTagline: e.target.value }))} className={inputClassSimple} placeholder="Intelligence in Action" />
                    </div>
                    <div>
                        <label className={labelClass}>Description</label>
                        <input type="text" value={signupData.orgDescription} onChange={e => setSignupData(p => ({ ...p, orgDescription: e.target.value }))} className={inputClassSimple} placeholder="What does your organization do?" />
                    </div>
                    <div>
                        <label className={labelClass}>Address</label>
                        <div className="relative">
                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-tertiary)]" />
                            <input type="text" value={signupData.orgAddress} onChange={e => setSignupData(p => ({ ...p, orgAddress: e.target.value }))} className={inputClass} placeholder="123 Main Street, City" />
                        </div>
                    </div>
                    <div>
                        <label className={labelClass}>Phone</label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-tertiary)]" />
                            <input type="tel" value={signupData.orgPhone} onChange={e => setSignupData(p => ({ ...p, orgPhone: e.target.value }))} className={inputClass} placeholder="+31 6 12345678" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelClass}>Chamber of Commerce *</label>
                            <div className="relative">
                                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-tertiary)]" />
                                <input type="text" value={signupData.orgKvk} onChange={e => setSignupData(p => ({ ...p, orgKvk: e.target.value }))} className={inputClass} placeholder="12345678" required />
                            </div>
                        </div>
                        <div>
                            <label className={labelClass}>VAT Number *</label>
                            <div className="relative">
                                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-tertiary)]" />
                                <input type="text" value={signupData.orgVat} onChange={e => setSignupData(p => ({ ...p, orgVat: e.target.value }))} className={inputClass} placeholder="NL123456789B01" required />
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)' }}>
                            <input type="checkbox" checked={signupData.orgAllowSignup} onChange={e => setSignupData(p => ({ ...p, orgAllowSignup: e.target.checked }))} className="accent-[var(--accent-primary)] w-4 h-4" />
                            <div>
                                <span className="text-sm font-medium block" style={{ color: 'var(--text-primary)' }}>Allow team members to join</span>
                                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Others can sign up and join your organization</span>
                            </div>
                        </label>
                    </div>
                </>
            ) : (
                /* --- Join existing org --- */
                <div>
                    <label className={labelClass}>Select Organization</label>
                    <div className="relative">
                        <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-tertiary)]" />
                        <select value={signupData.organizationId} onChange={e => setSignupData(p => ({ ...p, organizationId: e.target.value }))} className={inputClass} style={{ paddingLeft: '2.5rem' }} required>
                            <option value="" style={{ background: 'var(--bg-secondary)' }}>Select organization...</option>
                            {signupOrgs.map(org => (
                                <option key={org.id} value={org.id} style={{ background: 'var(--bg-secondary)' }}>{org.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            <button type="submit"
                className="w-full py-3 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg font-medium transition-all flex items-center justify-center gap-2 text-base shadow-lg mt-2">
                Continue <ArrowRight className="w-5 h-5" />
            </button>

            <button type="button" onClick={resetSignup}
                className="w-full py-2.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg font-medium transition-all flex items-center justify-center gap-2 text-sm">
                <ArrowLeft className="w-4 h-4" /> Back to Sign In
            </button>
        </form>
    );
};

export default SignupStepOrg;
