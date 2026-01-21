import React from 'react';
import CollapsibleSection from './CollapsibleSection';

interface RulesDisplayProps {
  ruleset: 'WRC2025';
  modifications?: string[];
}

const getRulesetInfo = (ruleset: 'WRC2025' | 'MahjongSoul') => {
  switch (ruleset) {
    case 'WRC2025':
      return {
        url: 'https://www.worldriichi.org/s/WRC-Rules-2025-42fx.pdf',
        displayName: 'WRC 2025'
      };
    case 'MahjongSoul':
      return {
        url: 'https://mahjongsoul.yo-star.com/faq',
        displayName: 'Mahjong Soul'
      };
    default:
      return {
        url: 'https://www.worldriichi.org/s/WRC-Rules-2025-42fx.pdf',
        displayName: 'WRC 2025'
      };
  }
};

const RulesDisplay: React.FC<RulesDisplayProps> = ({ ruleset, modifications = [] }) => {
  const rulesetInfo = getRulesetInfo(ruleset);

  return (
    <CollapsibleSection
      title="Rules"
      storageKey="rulesDisplayExpanded"
    >
      <div className="space-y-4">
        <div>
          <a
            href={rulesetInfo.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 underline font-medium"
          >
            {rulesetInfo.displayName}
          </a>
        </div>
        {modifications.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Tournament Modifications:</h3>
            <ul className="list-disc list-inside text-gray-700 space-y-1 ml-2">
              {modifications.map((modification, index) => (
                <li key={index}>{modification}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
};

export default RulesDisplay;
