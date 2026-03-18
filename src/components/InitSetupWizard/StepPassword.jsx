import React from 'react';

const StepPassword = ({ password, setPassword, confirmPassword, setConfirmPassword, inputClass, inputStyle, onNext }) => (
    <>
        <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Admin Password</label>
            <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Min 8 chars, upper + lower + number"
                className={inputClass} style={inputStyle}
                onKeyDown={e => e.key === 'Enter' && onNext()}
            />
        </div>
        <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Confirm Password</label>
            <input
                type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className={inputClass} style={inputStyle}
                onKeyDown={e => e.key === 'Enter' && onNext()}
            />
        </div>
    </>
);

export default StepPassword;
