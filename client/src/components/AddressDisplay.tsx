import React from 'react';
import { MapPinIcon } from '@heroicons/react/24/outline';
import { TournamentAddress } from '../services/api';

interface AddressDisplayProps {
  address: TournamentAddress;
  title?: string;
  showCard?: boolean;
}

const AddressDisplay: React.FC<AddressDisplayProps> = ({ 
  address, 
  title = 'Location',
  showCard = true 
}) => {
  // Build full address string for Google Maps
  const fullAddress = [
    address.streetAddress,
    address.addressLine2,
    `${address.city}, ${address.state} ${address.zipCode}`
  ].filter(Boolean).join(', ');
  
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;

  const content = (
    <>
      <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <MapPinIcon className="h-5 w-5" />
        {title}
      </h2>
      <div className="text-gray-700 space-y-1">
        <div>{address.streetAddress}</div>
        {address.addressLine2 && (
          <div>{address.addressLine2}</div>
        )}
        <div>
          {address.city}, {address.state} {address.zipCode}
        </div>
      </div>
      <div className="mt-3">
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary-600 hover:text-primary-700 text-sm font-medium inline-flex items-center gap-1"
        >
          <MapPinIcon className="h-4 w-4" />
          Open in Google Maps
        </a>
      </div>
    </>
  );

  if (showCard) {
    return (
      <div className="card">
        {content}
      </div>
    );
  }

  return <div>{content}</div>;
};

export default AddressDisplay;
