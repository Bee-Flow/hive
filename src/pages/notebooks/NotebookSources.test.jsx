import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import NotebookSources from './NotebookSources.jsx';

// Stub the meeting picker + capture context (not under test here).
vi.mock('../../components/meeting-picker/MeetingPicker', () => ({ default: () => null }));
vi.mock('../meeting-notes/capture/CaptureContext', () => ({ useCapture: () => ({ openCapture: () => {} }) }));

const SOURCES = [
  { id: 's1', type: 'pdf', name: 'Report.pdf', status: 'ready', wordCount: 1200, hasContent: true, metadata: {} },
  { id: 's2', type: 'text', name: 'Notes', status: 'processing', stage: 'embedding', hasContent: true, metadata: {} },
  { id: 's3', type: 'url', name: 'Article', status: 'error', error: 'Could not reach the URL', hasContent: false, metadata: {} },
];

const baseProps = (over = {}) => ({
  sources: SOURCES,
  onFileUpload: vi.fn(), onAddUrl: vi.fn(), onAddText: vi.fn(), onAddMeeting: vi.fn(),
  onDeleteSource: vi.fn(), onRetrySource: vi.fn(), onCancelSource: vi.fn(),
  onRenameSource: vi.fn(), onReorderSources: vi.fn(), onBulkDelete: vi.fn(),
  onPreviewSource: vi.fn().mockResolvedValue({ name: 'Report.pdf', content: 'hello world' }),
  dragOver: false, setDragOver: vi.fn(), totalWords: 1200, readyCount: 1,
  ...over,
});

describe('NotebookSources', () => {
  beforeEach(() => cleanup());

  it('shows the ingestion stage label while processing', () => {
    render(<NotebookSources {...baseProps()} />);
    expect(screen.getByText('Indexing…')).toBeTruthy(); // stage: embedding
  });

  it('renames a source via the inline editor', () => {
    const onRenameSource = vi.fn();
    render(<NotebookSources {...baseProps({ onRenameSource })} />);
    fireEvent.doubleClick(screen.getByText('Report.pdf'));
    const input = screen.getByDisplayValue('Report.pdf');
    fireEvent.change(input, { target: { value: 'Q4 Report' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onRenameSource).toHaveBeenCalledWith('s1', 'Q4 Report');
  });

  it('opens a preview for a source with stored content', async () => {
    const onPreviewSource = vi.fn().mockResolvedValue({ name: 'Report.pdf', content: 'extracted text body' });
    render(<NotebookSources {...baseProps({ onPreviewSource })} />);
    fireEvent.click(screen.getByText('Report.pdf'));
    expect(onPreviewSource).toHaveBeenCalledWith('s1');
    expect(await screen.findByText('extracted text body')).toBeTruthy();
  });

  it('selects multiple and bulk-deletes after confirm', () => {
    const onBulkDelete = vi.fn();
    render(<NotebookSources {...baseProps({ onBulkDelete })} />);
    // enter select mode
    fireEvent.click(screen.getByTitle('Select multiple'));
    // checkboxes appear; click the first two cards' checkboxes via their list rows
    const checks = document.querySelectorAll('button.w-4.h-4');
    fireEvent.click(checks[0]);
    fireEvent.click(checks[1]);
    expect(screen.getByText('2 selected')).toBeTruthy();
    // bulk-bar Delete opens the confirm dialog → now two "Delete" buttons exist
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]);
    const deletes = screen.getAllByRole('button', { name: 'Delete' });
    fireEvent.click(deletes[deletes.length - 1]); // dialog confirm
    expect(onBulkDelete).toHaveBeenCalled();
  });

  it('retries a failed text/url source (hasContent or url)', () => {
    const onRetrySource = vi.fn();
    render(<NotebookSources {...baseProps({ onRetrySource })} />);
    fireEvent.click(screen.getByTitle('Retry ingestion'));
    expect(onRetrySource).toHaveBeenCalledWith('s3');
  });
});
