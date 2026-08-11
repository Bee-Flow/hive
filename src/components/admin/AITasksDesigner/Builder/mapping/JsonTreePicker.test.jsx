import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import JsonTreePicker from './JsonTreePicker';

describe('JsonTreePicker', () => {
    beforeEach(() => cleanup());

    it('renders deeper than one level and emits full dotted paths', () => {
        const onPick = vi.fn();
        render(<JsonTreePicker value={{ order: { customer: { email: 'a@b.c' } } }} onPick={onPick} />);
        // Depth 0 + 1 are expanded by default, so the depth-2 leaf is visible.
        fireEvent.click(screen.getByText('email'));
        expect(onPick).toHaveBeenCalledWith('order.customer.email');
    });

    it('expands collapsed-by-default deep nodes via the chevron', () => {
        const onPick = vi.fn();
        const value = { a: { b: { c: { d: 'deep' } } } };
        render(<JsonTreePicker value={value} onPick={onPick} />);
        // `c` (depth 2) renders collapsed — its child `d` is hidden until toggled.
        expect(screen.queryByText('d')).toBeNull();
        fireEvent.click(screen.getByLabelText('Toggle c'));
        fireEvent.click(screen.getByText('d'));
        expect(onPick).toHaveBeenCalledWith('a.b.c.d');
    });

    it('bracket-quotes non-identifier keys', () => {
        const onPick = vi.fn();
        render(<JsonTreePicker value={{ 'key with spaces': { v: 7 } }} onPick={onPick} />);
        fireEvent.click(screen.getByText('v'));
        expect(onPick).toHaveBeenCalledWith('["key with spaces"].v');
        fireEvent.click(screen.getByText('key with spaces'));
        expect(onPick).toHaveBeenCalledWith('["key with spaces"]');
    });

    it('array toggle emits [0] by default and [*] on "each item"', () => {
        const onPick = vi.fn();
        render(<JsonTreePicker value={{ items: [{ sku: 'X1' }, { sku: 'X2' }] }} onPick={onPick} />);
        fireEvent.click(screen.getByText('sku'));
        expect(onPick).toHaveBeenLastCalledWith('items[0].sku');
        fireEvent.click(screen.getByText('each item'));
        fireEvent.click(screen.getByText('sku'));
        expect(onPick).toHaveBeenLastCalledWith('items[*].sku');
        // And back to first item.
        fireEvent.click(screen.getByText('first item'));
        fireEvent.click(screen.getByText('sku'));
        expect(onPick).toHaveBeenLastCalledWith('items[0].sku');
    });

    it('supports a ROOT array — paths start with the bracket segment', () => {
        const onPick = vi.fn();
        render(<JsonTreePicker value={[{ id: 'a' }, { id: 'b' }]} onPick={onPick} />);
        fireEvent.click(screen.getByText('id'));
        expect(onPick).toHaveBeenLastCalledWith('[0].id');
        fireEvent.click(screen.getByText('each item'));
        fireEvent.click(screen.getByText('id'));
        expect(onPick).toHaveBeenLastCalledWith('[*].id');
    });

    it('nested arrays compose the per-array toggles implicitly', () => {
        const onPick = vi.fn();
        const value = { orders: [{ lines: [{ sku: 'A' }] }] };
        render(<JsonTreePicker value={value} onPick={onPick} />);
        // `lines` sits at depth 2 (collapsed) — expand it, then its element.
        fireEvent.click(screen.getByLabelText('Toggle lines'));
        const elementToggles = screen.getAllByLabelText('Toggle [0]');
        fireEvent.click(elementToggles[elementToggles.length - 1]);
        // Both arrays default to "first item".
        fireEvent.click(screen.getByText('sku'));
        expect(onPick).toHaveBeenLastCalledWith('orders[0].lines[0].sku');
        // Flip BOTH toggles to "each item" → full flatten path (re-query
        // between clicks — the first flip re-renders the subtree).
        fireEvent.click(screen.getAllByText('each item')[0]);
        fireEvent.click(screen.getAllByText('each item')[1]);
        fireEvent.click(screen.getByText('sku'));
        expect(onPick).toHaveBeenLastCalledWith('orders[*].lines[*].sku');
    });

    it('truncates past maxChildren with a "… N more" row', () => {
        const big = Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`k${i}`, i]));
        render(<JsonTreePicker value={big} onPick={vi.fn()} maxChildren={3} />);
        expect(screen.getByText('k0')).toBeTruthy();
        expect(screen.getByText('k2')).toBeTruthy();
        expect(screen.queryByText('k3')).toBeNull();
        expect(screen.getByText(/… 2 more/)).toBeTruthy();
    });

    it('renders a friendly empty state for scalar input', () => {
        render(<JsonTreePicker value="not json" onPick={vi.fn()} />);
        expect(screen.getByText('No object or list to pick from.')).toBeTruthy();
    });
});
