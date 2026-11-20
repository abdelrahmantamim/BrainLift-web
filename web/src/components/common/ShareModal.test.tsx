import type React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShareModal } from './ShareModal';
import { sharingService } from '@/services/sharing.service';

// ShareModal creates its portal container in a mount-time useEffect and
// stashes it in a ref (not state), so the very first render with
// isOpen=true short-circuits to `null` before the effect has run — same as
// in the real app, where ShareModal is always mounted and only `isOpen`
// toggles later. Mirror that: mount closed, then open.

vi.mock('@/services/sharing.service', () => ({
  sharingService: {
    shareQuiz: vi.fn(),
    shareFlashcards: vi.fn(),
    shareMessage: vi.fn(),
    shareContent: vi.fn(),
    copyShareUrl: vi.fn(),
    trackEvent: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockShareResponse = {
  shareId: 'abc1234567',
  shareUrl: 'https://getbrainlift.app/share/quiz/abc1234567',
  previewUrl: 'https://getbrainlift.app/share/preview/quiz/abc1234567',
  qrCodeUrl: 'https://app.getbrainlift.app/api/qr/abc1234567/branded',
};

function renderModal(props?: Partial<React.ComponentProps<typeof ShareModal>>) {
  const baseProps: React.ComponentProps<typeof ShareModal> = {
    isOpen: true,
    onClose: vi.fn(),
    contentType: 'quiz',
    contentId: 'quiz-1',
    title: 'My Quiz',
    ...props,
  };
  // Mount closed first (matches real usage where ShareModal stays mounted
  // and only `isOpen` flips later), then open — see comment above.
  const { rerender } = render(<ShareModal {...baseProps} isOpen={false} />);
  rerender(<ShareModal {...baseProps} />);
  return { rerender };
}

describe('ShareModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (sharingService.shareQuiz as ReturnType<typeof vi.fn>).mockResolvedValue(mockShareResponse);
  });

  it('shows the QR code image with a loading skeleton once a share link is created', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(await screen.findByRole('button', { name: /create share link/i }));

    await waitFor(() => expect(sharingService.shareQuiz).toHaveBeenCalled());

    const qrImage = await screen.findByAltText('QR code linking to My Quiz');
    expect(qrImage).toHaveAttribute('src', mockShareResponse.qrCodeUrl);
    // Skeleton is present until the image fires onLoad
    expect(screen.getByTestId('qr-skeleton')).toBeInTheDocument();
  });

  it('renders social share buttons and opens the correct intent URL, tracking a share event', async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderModal();

    await user.click(await screen.findByRole('button', { name: /create share link/i }));
    await waitFor(() => expect(sharingService.shareQuiz).toHaveBeenCalled());

    const twitterButton = await screen.findByRole('button', { name: /share on x/i });
    await user.click(twitterButton);

    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining('https://twitter.com/intent/tweet'),
      '_blank',
      'noopener'
    );
    expect(sharingService.trackEvent).toHaveBeenCalledWith(
      mockShareResponse.shareId,
      'share',
      { channel: 'twitter' }
    );

    openSpy.mockRestore();
  });

  it('tracks a copy_link event when the copy button is clicked', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(await screen.findByRole('button', { name: /create share link/i }));
    await waitFor(() => expect(sharingService.shareQuiz).toHaveBeenCalled());

    const copyButton = await screen.findByRole('button', { name: /copy/i });
    await user.click(copyButton);

    await waitFor(() =>
      expect(sharingService.trackEvent).toHaveBeenCalledWith(mockShareResponse.shareId, 'copy_link')
    );
  });
});
