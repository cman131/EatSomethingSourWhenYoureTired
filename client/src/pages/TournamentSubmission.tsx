import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useMutation } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import { tournamentsApi } from '../services/api';
import Flatpickr from 'react-flatpickr';
import 'flatpickr/dist/themes/airbnb.css';

const TournamentSubmission: React.FC = () => {
  useRequireAuth();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date());

  const { mutate: createTournament, loading, error } = useMutation(
    (tournamentData: {
      name: string;
      description?: string;
      date: Date;
    }) => tournamentsApi.createTournament(tournamentData)
  );

  const isAdmin = user?.isAdmin === true;

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

    try {
      await createTournament({
        name: name.trim(),
        description: description.trim() || undefined,
        date,
      });
      navigate('/');
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
              maxLength={1000}
              placeholder="Enter tournament description..."
            />
            <p className="mt-1 text-xs text-gray-500">{description.length}/1000 characters</p>
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

