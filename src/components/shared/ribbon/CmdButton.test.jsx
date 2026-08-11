import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Plus } from 'lucide-react';
import CmdButton from './CmdButton';

describe('CmdButton — shared ribbon command', () => {
    it('renders label + title and fires onClick', () => {
        const onClick = vi.fn();
        render(<CmdButton icon={Plus} label="Add" title="Add a thing" onClick={onClick} />);
        const btn = screen.getByTitle('Add a thing');
        expect(btn).toHaveTextContent('Add');
        fireEvent.click(btn);
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('forwards buttonRef to the <button> and spreads dnd glue (onPointerDown, aria-describedby)', () => {
        const ref = vi.fn();
        const onPointerDown = vi.fn();
        render(
            <CmdButton
                label="Card"
                title="Card"
                onClick={() => {}}
                buttonRef={ref}
                onPointerDown={onPointerDown}
                aria-describedby="dnd-hint"
            />,
        );
        const btn = screen.getByTitle('Card');
        expect(ref).toHaveBeenCalledWith(btn);
        expect(btn).toHaveAttribute('aria-describedby', 'dnd-hint');
        fireEvent.pointerDown(btn);
        expect(onPointerDown).toHaveBeenCalledTimes(1);
    });

    it('dragging dims the button; grabbable sets touch-action none', () => {
        render(<CmdButton label="Drag" title="Drag" onClick={() => {}} dragging grabbable />);
        const btn = screen.getByTitle('Drag');
        expect(btn.style.opacity).toBe('0.4');
        expect(btn.style.touchAction).toBe('none');
        expect(btn.className).toContain('cursor-grab');
    });

    it('disabled blocks clicks natively', () => {
        const onClick = vi.fn();
        render(<CmdButton label="Locked" title="Locked" onClick={onClick} disabled />);
        fireEvent.click(screen.getByTitle('Locked'));
        expect(onClick).not.toHaveBeenCalled();
    });

    it('big + accent renders the vertical headline variant', () => {
        render(<CmdButton icon={Plus} label="AI step" title="AI step" onClick={() => {}} big accent />);
        const btn = screen.getByTitle('AI step');
        expect(btn.className).toContain('flex-col');
        expect(btn.className).toContain('text-[var(--accent)]');
    });

    it('renders the glyph fallback when no icon is given', () => {
        render(<CmdButton glyph={<span data-testid="logo" />} label="Gmail" title="Gmail" onClick={() => {}} />);
        expect(screen.getByTestId('logo')).toBeInTheDocument();
    });
});
