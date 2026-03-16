import React, { useState, useMemo } from 'react';

/**
 * FormRenderer - Renders a form from JSON definition and sends output to agent
 * Used for AI-generated interactive forms
 */
const FormRenderer = ({ code, title = 'Form', onSubmit, initialSubmitted = false, initialFormData = {} }) => {
    // Parse form definition first for default values
    const formDef = useMemo(() => {
        try {
            return JSON.parse(code);
        } catch {
            return null;
        }
    }, [code]);

    // Build initial state from defaultValues + initialFormData
    const [formData, setFormData] = useState(() => {
        const defaults = {};
        if (formDef?.fields) {
            formDef.fields.forEach(f => {
                if (f.defaultValue !== undefined) defaults[f.name] = f.defaultValue;
                if (f.type === 'checkbox' && f.defaultValue === undefined) defaults[f.name] = false;
            });
        }
        return { ...defaults, ...initialFormData };
    });
    const [isSubmitted, setIsSubmitted] = useState(initialSubmitted);
    const [isExpanded, setIsExpanded] = useState(true);

    if (!formDef) {
        return (
            <div className="my-4 p-4 rounded-xl border" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-tertiary)' }}>
                <div className="text-red-400 text-sm">Invalid form definition. Expected JSON format.</div>
                <pre className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>{code}</pre>
            </div>
        );
    }

    const handleChange = (fieldName, value) => {
        setFormData(prev => ({ ...prev, [fieldName]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        console.log('[FormRenderer] handleSubmit called');
        console.log('[FormRenderer] formData:', formData);
        console.log('[FormRenderer] onSubmit prop exists:', !!onSubmit);
        console.log('[FormRenderer] isSubmitted:', isSubmitted);

        // Prevent resubmission
        if (isSubmitted) {
            console.log('[FormRenderer] Already submitted, returning early');
            return;
        }

        setIsSubmitted(true);

        // Send form data to agent (pass object with flag for hidden message)
        if (onSubmit) {
            // Format the response for the AI but flag as form submission
            const formattedResponse = Object.entries(formData)
                .map(([key, value]) => `${key}: ${value}`)
                .join('\n');

            const submissionData = {
                text: `Form submitted:\n${formattedResponse}`,
                isFormSubmission: true,
                formData: formData
            };
            console.log('[FormRenderer] Calling onSubmit with:', submissionData);
            onSubmit(submissionData);
        } else {
            console.log('[FormRenderer] No onSubmit prop provided!');
        }
    };

    const renderField = (field) => {
        const { name, type = 'text', label, placeholder, options, required, min, max, step } = field;
        const value = formData[name] || '';

        const inputStyle = {
            width: '100%',
            padding: '10px 14px',
            borderRadius: '10px',
            border: '1px solid var(--border-default)',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            fontSize: '14px',
            outline: 'none',
            transition: 'border-color 0.2s'
        };

        switch (type) {
            case 'select':
                return (
                    <select
                        value={value}
                        onChange={(e) => handleChange(name, e.target.value)}
                        style={inputStyle}
                        required={required}
                        disabled={isSubmitted}
                    >
                        <option value="">{placeholder || 'Select an option...'}</option>
                        {(options || []).map((opt, i) => (
                            <option key={i} value={typeof opt === 'object' ? opt.value : opt}>
                                {typeof opt === 'object' ? opt.label : opt}
                            </option>
                        ))}
                    </select>
                );

            case 'textarea':
                return (
                    <textarea
                        value={value}
                        onChange={(e) => handleChange(name, e.target.value)}
                        placeholder={placeholder}
                        style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }}
                        required={required}
                        disabled={isSubmitted}
                    />
                );

            case 'checkbox':
                return (
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={!!formData[name]}
                            onChange={(e) => handleChange(name, e.target.checked)}
                            disabled={isSubmitted}
                            className="w-5 h-5 rounded"
                        />
                        <span style={{ color: 'var(--text-secondary)' }}>{placeholder || label}</span>
                    </label>
                );

            case 'radio':
                return (
                    <div className="space-y-2">
                        {(options || []).map((opt, i) => (
                            <label key={i} className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="radio"
                                    name={name}
                                    value={typeof opt === 'object' ? opt.value : opt}
                                    checked={value === (typeof opt === 'object' ? opt.value : opt)}
                                    onChange={(e) => handleChange(name, e.target.value)}
                                    disabled={isSubmitted}
                                    className="w-5 h-5"
                                />
                                <span style={{ color: 'var(--text-secondary)' }}>
                                    {typeof opt === 'object' ? opt.label : opt}
                                </span>
                            </label>
                        ))}
                    </div>
                );

            case 'range':
                return (
                    <div className="space-y-2">
                        <input
                            type="range"
                            value={value || min || 0}
                            onChange={(e) => handleChange(name, e.target.value)}
                            min={min || 0}
                            max={max || 100}
                            step={step || 1}
                            disabled={isSubmitted}
                            className="w-full"
                        />
                        <div className="text-sm text-center" style={{ color: 'var(--text-muted)' }}>
                            {value || min || 0}
                        </div>
                    </div>
                );

            case 'number':
                return (
                    <input
                        type="number"
                        value={value}
                        onChange={(e) => handleChange(name, e.target.value)}
                        placeholder={placeholder}
                        min={min}
                        max={max}
                        step={step}
                        style={inputStyle}
                        required={required}
                        disabled={isSubmitted}
                    />
                );

            case 'date':
            case 'time':
            case 'datetime-local':
            case 'email':
            case 'tel':
            case 'url':
                return (
                    <input
                        type={type}
                        value={value}
                        onChange={(e) => handleChange(name, e.target.value)}
                        placeholder={placeholder}
                        style={inputStyle}
                        required={required}
                        disabled={isSubmitted}
                    />
                );

            default: // text
                return (
                    <input
                        type="text"
                        value={value}
                        onChange={(e) => handleChange(name, e.target.value)}
                        placeholder={placeholder}
                        style={inputStyle}
                        required={required}
                        disabled={isSubmitted}
                    />
                );
        }
    };

    return (
        <div className="my-2 rounded-xl overflow-hidden" style={{ background: 'var(--bg-primary)' }}>

            {/* Form Content */}
            {isExpanded && (
                <form onSubmit={handleSubmit} className="p-4 space-y-4" style={{ background: 'var(--bg-primary)' }}>
                    {formDef.description && (
                        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                            {formDef.description}
                        </p>
                    )}

                    {(formDef.fields || []).map((field, index) => (
                        <div key={field.name || index} className="space-y-2">
                            {field.type !== 'checkbox' && field.label && (
                                <label className="block text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                                    {field.label}
                                    {field.required && <span className="text-red-400 ml-1">*</span>}
                                </label>
                            )}
                            {renderField(field)}
                            {field.hint && (
                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{field.hint}</p>
                            )}
                        </div>
                    ))}

                    {!isSubmitted ? (
                        <button
                            type="submit"
                            className="w-full py-3 px-4 rounded-xl font-medium text-white transition-all hover:scale-[1.02]"
                            style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}
                        >
                            {formDef.submitLabel || 'Submit'}
                        </button>
                    ) : (
                        <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl" style={{ background: 'rgba(16, 185, 129, 0.15)' }}>
                            <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="text-green-400 font-medium">Form submitted successfully</span>
                        </div>
                    )}
                </form>
            )}
        </div>
    );
};

export default FormRenderer;
