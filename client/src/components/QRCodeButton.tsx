import React, { useState } from 'react';
import { QrCodeIcon } from '@heroicons/react/24/outline';
import QRCodeModal from './QRCodeModal';

interface QRCodeButtonProps {
  url: string;
  className?: string;
}

const QRCodeButton: React.FC<QRCodeButtonProps> = ({
  url,
  className = 'btn-secondary flex items-center gap-2',
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={className}
        aria-label="QR Code"
        title="Show QR Code"
      >
        <QrCodeIcon className="h-5 w-5" />
        QR Code
      </button>
      <QRCodeModal isOpen={isOpen} onClose={() => setIsOpen(false)} url={url} />
    </>
  );
};

export default QRCodeButton;
