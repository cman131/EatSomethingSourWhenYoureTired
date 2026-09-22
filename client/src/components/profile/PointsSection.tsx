import React from 'react';
import { Link } from 'react-router-dom';
import { User } from '../../services/api';

interface PointsSectionProps {
  user: User;
  isOwnProfile: boolean;
}

const PointsSection: React.FC<PointsSectionProps> = ({ user, isOwnProfile }) => {
  const balance = user.pointsBalance ?? 0;
  const totalEarned = user.totalPointsEarned ?? 0;

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Club Points</h2>
        {isOwnProfile && (
          <Link to="/points" className="text-sm text-indigo-600 hover:text-indigo-800">
            View history
          </Link>
        )}
      </div>
      {/* Spendable balance is owner-only: the server omits it from other members' responses. */}
      <div className={isOwnProfile ? 'grid grid-cols-2 gap-4' : 'grid grid-cols-1 gap-4'}>
        {isOwnProfile && (
          <div className="text-center">
            <p className="text-sm text-gray-500">Balance</p>
            <p className="text-3xl font-bold text-indigo-600">{balance}</p>
          </div>
        )}
        <div className="text-center">
          <p className="text-sm text-gray-500">Total Earned</p>
          <p className="text-3xl font-bold text-gray-800">{totalEarned}</p>
        </div>
      </div>
    </div>
  );
};

export default PointsSection;
