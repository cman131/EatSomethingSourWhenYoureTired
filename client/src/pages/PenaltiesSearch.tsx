import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MagnifyingGlassIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { wrcPenalties, metadata, PenaltyEntry, PenaltyType } from '../data/wrcPenalties';

function highlightText(text: string, term: string): React.ReactNode {
  if (!term.trim()) return text;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === term.toLowerCase()
      ? <mark key={i} className="bg-yellow-200 text-yellow-900 rounded px-0.5">{part}</mark>
      : part
  );
}

function penaltyBadgeClass(type: PenaltyType): string {
  switch (type) {
    case 'disqualification': return 'bg-red-100 text-red-800';
    case 'chonbo':           return 'bg-orange-100 text-orange-800';
    case 'dead_hand':        return 'bg-yellow-100 text-yellow-800';
    case 'point_penalty':    return 'bg-blue-100 text-blue-800';
    case 'warning':          return 'bg-gray-100 text-gray-700';
    case 'discretion':       return 'bg-purple-100 text-purple-800';
    default:                 return 'bg-gray-100 text-gray-500';
  }
}

const PenaltiesSearch: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') ?? '');

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    if (value.trim()) {
      setSearchParams({ q: value });
    } else {
      setSearchParams({});
    }
  };

  const filteredEntries = useMemo(() => {
    if (!searchTerm.trim()) return wrcPenalties;
    const lower = searchTerm.toLowerCase();
    return wrcPenalties.filter((entry) =>
      entry.sectionTitle.toLowerCase().includes(lower) ||
      entry.subsectionTitle.toLowerCase().includes(lower) ||
      entry.description.toLowerCase().includes(lower) ||
      entry.penalty.toLowerCase().includes(lower) ||
      entry.tags.some((tag) => tag.toLowerCase().includes(lower))
    );
  }, [searchTerm]);

  // Group entries by section number for display
  const groupedEntries = useMemo(() => {
    const groups = new Map<string, { sectionTitle: string; entries: PenaltyEntry[] }>();
    for (const entry of filteredEntries) {
      const existing = groups.get(entry.sectionNumber);
      if (existing) {
        existing.entries.push(entry);
      } else {
        groups.set(entry.sectionNumber, {
          sectionTitle: entry.sectionTitle,
          entries: [entry],
        });
      }
    }
    return groups;
  }, [filteredEntries]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">WRC Penalties 2025</h1>
          <p className="mt-1 text-sm text-gray-500">
            World Riichi Championship penalty reference — search by keyword to find the relevant rule.
          </p>
        </div>
        <a
          href={metadata.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center text-sm text-primary-600 hover:text-primary-800 whitespace-nowrap"
        >
          <ArrowTopRightOnSquareIcon className="h-4 w-4 mr-1" />
          Full PDF
        </a>
      </div>

      {/* Search bar */}
      <div className="card">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder='Search penalties, e.g. "chombo", "dead hand", "riichi", "late"…'
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            className="input-field pl-10"
            autoFocus
          />
        </div>
        {searchTerm.trim() && (
          <p className="mt-2 text-sm text-gray-500">
            {filteredEntries.length === 0
              ? 'No results found.'
              : `${filteredEntries.length} result${filteredEntries.length !== 1 ? 's' : ''} for "${searchTerm}"`}
          </p>
        )}
      </div>

      {/* Results */}
      {filteredEntries.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500">No matching rules found for &ldquo;{searchTerm}&rdquo;.</p>
          <p className="mt-1 text-sm text-gray-400">Try different keywords or browse the full PDF.</p>
        </div>
      ) : (
        Array.from(groupedEntries.entries()).map(([sectionNum, group]) => (
          <div key={sectionNum} className="space-y-3">
            {/* Section header */}
            <h2 className="text-lg font-semibold text-gray-700 border-b border-gray-200 pb-1">
              {sectionNum} — {group.sectionTitle}
            </h2>

            {/* Entries */}
            {group.entries.map((entry) => (
              <div key={entry.id} className="card">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                  <h3 className="font-medium text-gray-900">
                    {searchTerm.trim()
                      ? highlightText(entry.subsectionTitle, searchTerm)
                      : entry.subsectionTitle}
                  </h3>
                  {entry.penalty && entry.penaltyType !== 'none' && (
                    <span
                      className={`inline-block shrink-0 text-xs font-medium px-2 py-1 rounded-full ${penaltyBadgeClass(entry.penaltyType)}`}
                    >
                      {entry.penalty}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {searchTerm.trim()
                    ? highlightText(entry.description, searchTerm)
                    : entry.description}
                </p>
              </div>
            ))}
          </div>
        ))
      )}

      <p className="text-xs text-gray-400 text-center pb-4">
        {metadata.source} · {metadata.author} · v20250525
      </p>
    </div>
  );
};

export default PenaltiesSearch;
