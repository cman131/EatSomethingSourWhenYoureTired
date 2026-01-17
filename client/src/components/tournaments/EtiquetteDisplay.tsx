import React from 'react';
import CollapsibleSection from './CollapsibleSection';

const EtiquetteDisplay: React.FC = () => {
  const videoId = 'pPGZq3WxW84';
  const embedUrl = `https://www.youtube.com/embed/${videoId}`;

  return (
    <CollapsibleSection
      title="Etiquette"
      storageKey="etiquetteDisplayExpanded"
    >
      <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
        <iframe
          className="absolute top-0 left-0 w-full h-full rounded-lg"
          src={embedUrl}
          title="Etiquette Video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </CollapsibleSection>
  );
};

export default EtiquetteDisplay;
