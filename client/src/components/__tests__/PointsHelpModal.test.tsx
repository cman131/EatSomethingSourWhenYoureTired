import React from 'react';
import { render, screen, within, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import PointsHelpModal from '../PointsHelpModal';

jest.mock('../../hooks/useApi', () => ({
  useApi: jest.fn(),
}));

jest.mock('../../services/api', () => ({
  pointsApi: { getConfig: jest.fn() },
}));

const { useApi } = require('../../hooks/useApi');
const { pointsApi } = require('../../services/api');

const mockConfig = {
  gamePlacementAmounts: { 1: 10, 2: 7, 3: 4, 4: 2 },
  gameSubmittedAmount: 2,
  gameVerifiedAmount: 1,
  gameDailyCap: 60,
  gameDailyWindowHours: 24,
  repeatGroupMaxGames: 6,
  repeatGroupWindowDays: 7,
  tournamentParticipationAmount: 15,
  tournamentPlacementAmounts: [200, 100, 70, 50],
  rankedQualificationAmount: 10,
  rankedPlacementAmounts: [150, 100, 50],
  quizCompletionAmount: 1,
  quizWeeklyCapCount: 5,
  weeklyStreakAmounts: [2, 3, 4, 5],
};

function mockLoaded(data: unknown = mockConfig) {
  useApi.mockReturnValue({ data: { data }, loading: false, error: null });
}

function expectRowPoints(sectionName: string, label: string, points: string) {
  const section = screen.getByRole('region', { name: sectionName });
  const row = within(section).getByText(label).closest('tr') as HTMLElement;
  expect(within(row).getByText(points)).toBeInTheDocument();
}

describe('PointsHelpModal', () => {
  test('renders the modal heading', () => {
    mockLoaded();
    render(<PointsHelpModal onClose={jest.fn()} />);
    expect(screen.getByText('How to Earn Points')).toBeInTheDocument();
  });

  test('shows a loading state while fetching config', () => {
    useApi.mockReturnValue({ data: null, loading: true, error: null });
    render(<PointsHelpModal onClose={jest.fn()} />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  test('shows an error state when the config fetch fails', () => {
    useApi.mockReturnValue({ data: null, loading: false, error: 'network error' });
    render(<PointsHelpModal onClose={jest.fn()} />);
    expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
  });

  test('renders all six section headings once loaded', () => {
    mockLoaded();
    render(<PointsHelpModal onClose={jest.fn()} />);
    expect(screen.getByRole('heading', { name: 'Games' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tournaments' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ranked League' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Limits' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Quizzes' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Weekly Streak' })).toBeInTheDocument();
  });

  test.each([
    ['1st place', '+10'],
    ['2nd place', '+7'],
    ['3rd place', '+4'],
    ['4th place', '+2'],
    ['Submit a game', '+2'],
    ['Verify a game', '+1'],
  ])('Games section: %s awards %s', (label, points) => {
    mockLoaded();
    render(<PointsHelpModal onClose={jest.fn()} />);
    expectRowPoints('Games', label, points);
  });

  test.each([
    ['Participate', '+15'],
    ['1st place', '+200'],
    ['2nd place', '+100'],
    ['3rd place', '+70'],
    ['4th place', '+50'],
  ])('Tournaments section: %s awards %s', (label, points) => {
    mockLoaded();
    render(<PointsHelpModal onClose={jest.fn()} />);
    expectRowPoints('Tournaments', label, points);
  });

  test('Ranked League section awards qualify points for reaching the leaderboard', () => {
    mockLoaded();
    render(<PointsHelpModal onClose={jest.fn()} />);
    expectRowPoints('Ranked League', 'Qualify for the leaderboard', '+10');
  });

  test('Quizzes section shows the amount and the weekly cap', () => {
    mockLoaded();
    render(<PointsHelpModal onClose={jest.fn()} />);
    expectRowPoints('Quizzes', 'Complete a quiz', '+1');
    expect(screen.getByText(/5 points per week/i)).toBeInTheDocument();
  });

  test('Weekly Streak section mentions the escalating amounts and the cap', () => {
    mockLoaded();
    render(<PointsHelpModal onClose={jest.fn()} />);
    const section = screen.getByRole('region', { name: 'Weekly Streak' });
    expect(within(section).getByText(/\+2/)).toBeInTheDocument();
    expect(within(section).getByText(/capped at \+5/i)).toBeInTheDocument();
  });

  test('Limits section explains the game caps and that tournament awards are not limited', () => {
    mockLoaded();
    render(<PointsHelpModal onClose={jest.fn()} />);
    const section = screen.getByRole('region', { name: 'Limits' });
    expect(within(section).getByText(/\b60 game points\b/i)).toBeInTheDocument();
    expect(within(section).getByText(/24-hour period/i)).toBeInTheDocument();
    expect(within(section).getByText(/same set of registered players/i)).toBeInTheDocument();
    expect(within(section).getByText(/guests don't count/i)).toBeInTheDocument();
    expect(within(section).getByText(/\b6 games\b/i)).toBeInTheDocument();
    expect(within(section).getByText(/7 days/i)).toBeInTheDocument();
    expect(within(section).getByText(/award no points/i)).toBeInTheDocument();
    expect(within(section).getByText(/tournament awards are not limited/i)).toBeInTheDocument();
  });

  test('calls onClose when the X button is clicked', () => {
    mockLoaded();
    const onClose = jest.fn();
    render(<PointsHelpModal onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('calls onClose when the backdrop is clicked', () => {
    mockLoaded();
    const onClose = jest.fn();
    render(<PointsHelpModal onClose={onClose} />);
    fireEvent.click(screen.getByTestId('modal-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('does not call onClose when the modal content is clicked', () => {
    mockLoaded();
    const onClose = jest.fn();
    render(<PointsHelpModal onClose={onClose} />);
    fireEvent.click(screen.getByText('How to Earn Points'));
    expect(onClose).not.toHaveBeenCalled();
  });
});
