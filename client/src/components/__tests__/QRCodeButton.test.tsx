import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import QRCodeButton from '../QRCodeButton';

jest.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value }: { value: string }) => <svg data-testid="qr-code" data-value={value} />,
}));

describe('QRCodeButton', () => {
  const url = 'https://example.com/tournament/123';

  it('renders a QR code button', () => {
    render(<QRCodeButton url={url} />);
    expect(screen.getByRole('button', { name: /qr code/i })).toBeInTheDocument();
  });

  it('does not show the modal initially', () => {
    render(<QRCodeButton url={url} />);
    expect(screen.queryByTestId('qr-code')).not.toBeInTheDocument();
  });

  it('opens the modal when the button is clicked', () => {
    render(<QRCodeButton url={url} />);
    fireEvent.click(screen.getByRole('button', { name: /qr code/i }));
    expect(screen.getByTestId('qr-code')).toBeInTheDocument();
  });

  it('closes the modal when the close button is clicked', () => {
    render(<QRCodeButton url={url} />);
    fireEvent.click(screen.getByRole('button', { name: /qr code/i }));
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(screen.queryByTestId('qr-code')).not.toBeInTheDocument();
  });
});
