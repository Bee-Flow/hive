import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import ToolInputForm from './ToolInputForm';
import { typeInEditor } from '../../../../../test/refEditor';

describe('ToolInputForm — adding inputs', () => {
    beforeEach(() => cleanup());

    it('does NOT write an empty input when a field is added (so autosave cannot strip it)', () => {
        const onChange = vi.fn();
        render(<ToolInputForm inputs={{}} onChange={onChange} inputSchema={null} />);
        fireEvent.click(screen.getByText('Add field'));
        // Row appears locally…
        expect(screen.getByDisplayValue('field')).toBeTruthy();
        // …but nothing is committed/saved yet (empty rows would vanish on save).
        expect(onChange).not.toHaveBeenCalled();
    });

    it('keeps the new row visible across a re-render with unchanged inputs (the autosave round-trip)', () => {
        const onChange = vi.fn();
        const { rerender } = render(<ToolInputForm inputs={{}} onChange={onChange} inputSchema={null} />);
        fireEvent.click(screen.getByText('Add field'));
        expect(screen.getByDisplayValue('field')).toBeTruthy();
        // Parent re-renders with the same (empty) inputs — previously this is when
        // the flash-and-vanish happened. The local pending row must survive.
        rerender(<ToolInputForm inputs={{}} onChange={onChange} inputSchema={null} />);
        expect(screen.getByDisplayValue('field')).toBeTruthy();
    });

    it('commits the row to inputs once it has a value and loses focus', () => {
        const onChange = vi.fn();
        render(<ToolInputForm inputs={{}} onChange={onChange} inputSchema={null} />);
        fireEvent.click(screen.getByText('Add field'));
        const valueInput = screen.getByPlaceholderText('value');
        typeInEditor(valueInput, 'hello');
        expect(onChange).not.toHaveBeenCalled(); // still local until blur
        fireEvent.blur(valueInput);
        expect(onChange).toHaveBeenCalledWith({ field: { kind: 'literal', value: 'hello' } });
    });

    it('adds empty named fields immediately when keepEmptyFields (Set / layer_output)', () => {
        const onChange = vi.fn();
        render(<ToolInputForm inputs={{}} onChange={onChange} inputSchema={null} keepEmptyFields />);
        fireEvent.click(screen.getByText('Add field'));
        expect(onChange).toHaveBeenCalledWith({ field: { kind: 'literal', value: '' } });
    });

    it('hides "Add custom field" for a fixed schema (allowExtraFields=false) and shows it when allowed', () => {
        const schema = { properties: { query: { title: 'query' } }, required: ['query'] };
        const { rerender } = render(
            <ToolInputForm inputs={{}} onChange={vi.fn()} inputSchema={schema} allowExtraFields={false} />,
        );
        expect(screen.queryByText('Add custom field')).toBeNull();
        rerender(<ToolInputForm inputs={{}} onChange={vi.fn()} inputSchema={schema} allowExtraFields={true} />);
        expect(screen.getByText('Add custom field')).toBeTruthy();
    });
});
