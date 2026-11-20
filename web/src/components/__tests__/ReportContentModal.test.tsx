import type React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReportContentModal } from '../common/ReportContentModal';
import api from '@/services/api';

// ReportContentModal creates its own portal container in a mount-time
// useEffect (mirrors ShareModal), so mount closed first, then open — see
// ShareModal.test.tsx for the same convention.

vi.mock('@/services/api', () => ({
  default: {
    post: vi.fn(),
  },
}));

function renderModal(props?: Partial<React.ComponentProps<typeof ReportContentModal>>) {
  const baseProps: React.ComponentProps<typeof ReportContentModal> = {
    isOpen: true,
    shareId: 'abc1234567',
    onClose: vi.fn(),
    ...props,
  };
  const { rerender } = render(<ReportContentModal {...baseProps} isOpen={false} />);
  rerender(<ReportContentModal {...baseProps} />);
  return { rerender, onClose: baseProps.onClose };
}

describe('ReportContentModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all 5 reason options and an optional details textarea', () => {
    renderModal();

    expect(screen.getByRole('radio', { name: /spam/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /inappropriate content/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /malicious or harmful/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /copyright violation/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^other$/i })).toBeInTheDocument();

    expect(screen.getByPlaceholderText(/additional details/i)).toBeInTheDocument();
  });

  it('submits the exact payload with shareId, reason, and details', async () => {
    const user = userEvent.setup();
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { success: true } });
    renderModal({ shareId: 'xyz9876543' });

    await user.click(screen.getByRole('radio', { name: /copyright violation/i }));
    await user.type(screen.getByPlaceholderText(/additional details/i), 'This is my content');
    await user.click(screen.getByRole('button', { name: /submit report/i }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/share/report-content', {
        shareId: 'xyz9876543',
        reason: 'copyright',
        details: 'This is my content',
      })
    );

    expect(await screen.findByText(/thanks.*our team will review this/i)).toBeInTheDocument();
  });

  it('shows a friendly "Already reported" state on a duplicate-report response, not an error toast', async () => {
    const user = userEvent.setup();
    (api.post as ReturnType<typeof vi.fn>).mockRejectedValue({
      response: {
        status: 400,
        data: { success: false, error: 'You have already reported this content' },
      },
    });
    renderModal();

    await user.click(screen.getByRole('radio', { name: /spam/i }));
    await user.click(screen.getByRole('button', { name: /submit report/i }));

    expect(await screen.findByText('Already reported')).toBeInTheDocument();
    expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
  });
});
