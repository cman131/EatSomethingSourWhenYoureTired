import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import PointsSection from './PointsSection';

const user = { pointsBalance: 42, totalPointsEarned: 100 } as any;

const renderSection = (isOwnProfile: boolean) =>
  render(
    <MemoryRouter>
      <PointsSection user={user} isOwnProfile={isOwnProfile} />
    </MemoryRouter>
  );

describe('PointsSection balance visibility', () => {
  test('shows the spendable balance on your own profile', () => {
    renderSection(true);

    expect(screen.getByText('Balance')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  test('hides the spendable balance on another member\'s profile', () => {
    renderSection(false);

    expect(screen.queryByText('Balance')).not.toBeInTheDocument();
    expect(screen.queryByText('42')).not.toBeInTheDocument();
  });

  test('still shows lifetime points earned on another member\'s profile', () => {
    renderSection(false);

    expect(screen.getByText('Total Earned')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });
});
