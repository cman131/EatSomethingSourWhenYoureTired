import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useMutation } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import { tournamentsApi, TournamentAddress } from '../services/api';
import Flatpickr from 'react-flatpickr';
import 'flatpickr/dist/themes/airbnb.css';

// All 50 US states with abbreviations
const US_STATES = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
];

const TournamentSubmission: React.FC = () => {
  useRequireAuth();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date());
  const [address, setAddress] = useState({
    streetAddress: '',
    addressLine2: '',
    city: '',
    state: '',
    stateName: '',
    zipCode: ''
  });
  const [stateSearchTerm, setStateSearchTerm] = useState('');
  const [stateSearchResults, setStateSearchResults] = useState<typeof US_STATES>([]);
  const [isStateDropdownOpen, setIsStateDropdownOpen] = useState(false);
  const stateInputRef = useRef<HTMLInputElement | null>(null);

  const { mutate: createTournament, loading, error } = useMutation(
    (tournamentData: {
      name: string;
      description?: string;
      date: Date;
      location: TournamentAddress;
    }) => tournamentsApi.createTournament(tournamentData)
  );

  const isAdmin = user?.isAdmin === true;

  // Initialize state search term if state is already set
  useEffect(() => {
    if (address.state && !stateSearchTerm) {
      const selectedState = US_STATES.find(s => s.code === address.state);
      if (selectedState) {
        setStateSearchTerm(selectedState.name);
        setAddress({ ...address, stateName: selectedState.name });
      }
    }
  }, [address, stateSearchTerm]); // Only run on mount

  // Filter states based on search term
  useEffect(() => {
    if (stateSearchTerm.trim().length > 0) {
      const searchLower = stateSearchTerm.toLowerCase();
      const filtered = US_STATES.filter(
        (state) =>
          state.name.toLowerCase().includes(searchLower) ||
          state.code.toLowerCase().includes(searchLower)
      );
      setStateSearchResults(filtered);
      setIsStateDropdownOpen(true);
    } else {
      setStateSearchResults([]);
      setIsStateDropdownOpen(false);
    }
  }, [stateSearchTerm]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (stateInputRef.current) {
        const target = event.target as Node;
        if (!stateInputRef.current.contains(target)) {
          const dropdown = stateInputRef.current.parentElement?.querySelector('.state-search-dropdown');
          if (dropdown && !dropdown.contains(target)) {
            setIsStateDropdownOpen(false);
            // Restore the selected state name if a state was previously selected
            if (address.state) {
              const selectedState = US_STATES.find(s => s.code === address.state);
              if (selectedState) {
                setStateSearchTerm(selectedState.name);
              }
            } else {
              setStateSearchTerm('');
            }
          }
        }
      }
    };

    if (isStateDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isStateDropdownOpen, address.state]);

  const handleStateSearchChange = (value: string) => {
    setStateSearchTerm(value);
    // Clear state selection if user is typing
    if (value !== address.stateName) {
      setAddress({ ...address, state: '', stateName: '' });
    }
  };

  const selectState = (state: typeof US_STATES[0]) => {
    setAddress({ ...address, state: state.code, stateName: state.name });
    setStateSearchTerm(state.name);
    setIsStateDropdownOpen(false);
    setStateSearchResults([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert('Tournament name is required');
      return;
    }

    if (!date) {
      alert('Tournament date is required');
      return;
    }

    if (!address.streetAddress.trim() || !address.city.trim() || !address.state.trim() || !address.zipCode.trim()) {
      alert('Please fill in all required address fields (street address, city, state, and zip code)');
      return;
    }

    // Validate state is selected and is a valid state code
    if (!address.state.trim() || !US_STATES.find(s => s.code === address.state)) {
      alert('Please select a valid state from the dropdown');
      return;
    }

    // Validate zip code format
    const zipCodeRegex = /^\d{5}(-\d{4})?$/;
    if (!zipCodeRegex.test(address.zipCode.trim())) {
      alert('Zip code must be in format 12345 or 12345-6789');
      return;
    }

    try {
      const response = await createTournament({
        name: name.trim(),
        description: description.trim() || undefined,
        date,
        location: {
          streetAddress: address.streetAddress.trim(),
          addressLine2: address.addressLine2.trim() || undefined,
          city: address.city.trim(),
          state: address.state.trim().toUpperCase(),
          zipCode: address.zipCode.trim()
        },
      });
      // Navigate to the newly created tournament's detail page
      if (response.data.tournament._id) {
        navigate(`/tournaments/${response.data.tournament._id}`);
      } else {
        navigate('/tournaments');
      }
    } catch (err) {
      console.error('Failed to create tournament:', err);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Create Tournament</h1>

      {!isAdmin && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <p className="text-sm text-red-600">
            You must be an administrator to create tournaments. Please contact an administrator if you need to create a tournament.
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {isAdmin && (
        <form onSubmit={handleSubmit} className="card space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              Tournament Name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field"
              required
              maxLength={100}
              placeholder="Enter tournament name"
            />
            <p className="mt-1 text-xs text-gray-500">{name.length}/100 characters</p>
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              Description (optional)
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-field"
              rows={4}
              maxLength={5000}
              placeholder="Enter tournament description..."
            />
            <p className="mt-1 text-xs text-gray-500">{description.length}/5000 characters</p>
          </div>

          <div>
            <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-2">
              Tournament Date <span className="text-red-500">*</span>
            </label>
            <Flatpickr
              id="date"
              className="input-field"
              required
              value={date ? new Date(date) : undefined}
              onChange={(dates) => setDate(dates[0])}
              options={{
                enableTime: true,
                time_24hr: false,
                minuteIncrement: 10,
                dateFormat: 'm-d-Y h:i K',
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Location <span className="text-red-500">*</span>
            </label>
            <div className="space-y-4">
              <div>
                <label htmlFor="streetAddress" className="block text-xs text-gray-600 mb-1">
                  Street Address <span className="text-red-500">*</span>
                </label>
                <input
                  id="streetAddress"
                  type="text"
                  value={address.streetAddress}
                  onChange={(e) => setAddress({ ...address, streetAddress: e.target.value })}
                  className="input-field"
                  required
                  maxLength={200}
                  placeholder="123 Main St"
                />
              </div>

              <div>
                <label htmlFor="addressLine2" className="block text-xs text-gray-600 mb-1">
                  Address Line 2 (optional)
                </label>
                <input
                  id="addressLine2"
                  type="text"
                  value={address.addressLine2}
                  onChange={(e) => setAddress({ ...address, addressLine2: e.target.value })}
                  className="input-field"
                  maxLength={100}
                  placeholder="Apt, Suite, Unit, etc."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="city" className="block text-xs text-gray-600 mb-1">
                    City <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="city"
                    type="text"
                    value={address.city}
                    onChange={(e) => setAddress({ ...address, city: e.target.value })}
                    className="input-field"
                    required
                    maxLength={100}
                    placeholder="City"
                  />
                </div>

                <div>
                  <label htmlFor="state" className="block text-xs text-gray-600 mb-1">
                    State <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      ref={stateInputRef}
                      id="state"
                      type="text"
                      placeholder="Search for state..."
                      value={stateSearchTerm}
                      onChange={(e) => handleStateSearchChange(e.target.value)}
                      onFocus={() => {
                        setIsStateDropdownOpen(true);
                        if (stateSearchTerm.trim().length > 0) {
                          const searchLower = stateSearchTerm.toLowerCase();
                          const filtered = US_STATES.filter(
                            (state) =>
                              state.name.toLowerCase().includes(searchLower) ||
                              state.code.toLowerCase().includes(searchLower)
                          );
                          setStateSearchResults(filtered);
                        }
                      }}
                      className="input-field"
                      required
                    />
                    {isStateDropdownOpen && (
                      <div className="state-search-dropdown absolute left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto z-50">
                        {stateSearchResults.length > 0 ? (
                          <div className="py-1">
                            {stateSearchResults.map((state) => (
                              <button
                                key={state.code}
                                type="button"
                                onClick={() => selectState(state)}
                                className="w-full text-left px-4 py-2 hover:bg-primary-50 transition-colors cursor-pointer"
                              >
                                <div className="font-medium text-gray-900">
                                  {state.name} ({state.code})
                                </div>
                              </button>
                            ))}
                          </div>
                        ) : stateSearchTerm.trim().length > 0 ? (
                          <div className="px-4 py-3 text-sm text-gray-500 text-center">
                            No states found matching "{stateSearchTerm}"
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="zipCode" className="block text-xs text-gray-600 mb-1">
                  Zip Code <span className="text-red-500">*</span>
                </label>
                <input
                  id="zipCode"
                  type="text"
                  value={address.zipCode}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^\d-]/g, '');
                    setAddress({ ...address, zipCode: value });
                  }}
                  className="input-field"
                  required
                  maxLength={10}
                  placeholder="12345 or 12345-6789"
                  pattern="\d{5}(-\d{4})?"
                />
                <p className="mt-1 text-xs text-gray-500">Format: 12345 or 12345-6789</p>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create Tournament'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default TournamentSubmission;

