import React from 'react';
import { render, screen, within, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import PointsHelpModal from '../PointsHelpModal';

describe('PointsHelpModal', () => {
  test('renders the modal heading', () => {
    render(<PointsHelpModal onClose={jest.fn()} />);
    expect(screen.getByText('How to Earn Points')).toBeInTheDocument();
  });

  test('renders all three section headings', () => {
    render(<PointsHelpModal onClose={jest.fn()} />);
    expect(screen.getByRole('heading', { name: 'Games' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tournaments' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ranked League' })).toBeInTheDocument();
  });

  test('Games section shows correct point values', () => {
    render(<PointsHelpModal onClose={jest.fn()} />);
    const gamesSection = screen.getByRole('region', { name: 'Games' });
    expect(within(gamesSection).getByText('+8')).toBeInTheDocument();
    expect(within(gamesSection).getByText('+3')).toBeInTheDocument();
    expect(within(gamesSection).getByText('+1')).toBeInTheDocument();
    expect(within(gamesSection).getByText('Submit a game')).toBeInTheDocument();
    expect(within(gamesSection).getByText('Verify a game')).toBeInTheDocument();
  });

  test('Tournaments section shows correct point values', () => {
    render(<PointsHelpModal onClose={jest.fn()} />);
    const tourSection = screen.getByRole('region', { name: 'Tournaments' });
    expect(within(tourSection).getByText('Participate')).toBeInTheDocument();
    expect(within(tourSection).getByText('+15')).toBeInTheDocument();
    expect(within(tourSection).getByText('+40')).toBeInTheDocument();
  });

  test('Ranked League section shows qualify points and coming soon', () => {
    render(<PointsHelpModal onClose={jest.fn()} />);
    const leagueSection = screen.getByRole('region', { name: 'Ranked League' });
    expect(within(leagueSection).getByText('Qualify (join league)')).toBeInTheDocument();
    expect(within(leagueSection).getByText('+10')).toBeInTheDocument();
    expect(within(leagueSection).getByText('Coming soon')).toBeInTheDocument();
  });

  test('calls onClose when the X button is clicked', () => {
    const onClose = jest.fn();
    render(<PointsHelpModal onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('calls onClose when the backdrop is clicked', () => {
    const onClose = jest.fn();
    render(<PointsHelpModal onClose={onClose} />);
    fireEvent.click(screen.getByTestId('modal-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('does not call onClose when the modal content is clicked', () => {
    const onClose = jest.fn();
    render(<PointsHelpModal onClose={onClose} />);
    fireEvent.click(screen.getByText('How to Earn Points'));
    expect(onClose).not.toHaveBeenCalled();
  });
});
