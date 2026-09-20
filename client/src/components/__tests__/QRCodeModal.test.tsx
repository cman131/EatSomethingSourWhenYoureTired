import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import QRCodeModal from '../QRCodeModal';

jest.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value }: { value: string }) => <svg data-testid="qr-code" data-value={value} />,
}));

describe('QRCodeModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    url: 'https://example.com/tournament/123',
  };

  it('renders the modal when isOpen is true', () => {
    render(<QRCodeModal {...defaultProps} />);
    expect(screen.getByText('QR Code')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(<QRCodeModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('QR Code')).not.toBeInTheDocument();
  });

  it('renders a QR code with the provided URL', () => {
    render(<QRCodeModal {...defaultProps} />);
    const qr = screen.getByTestId('qr-code');
    expect(qr).toBeInTheDocument();
    expect(qr).toHaveAttribute('data-value', defaultProps.url);
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = jest.fn();
    render(<QRCodeModal {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = jest.fn();
    render(<QRCodeModal {...defaultProps} onClose={onClose} />);
    fireEvent.click(document.querySelector('.fixed.inset-0.bg-gray-500') as Element);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
