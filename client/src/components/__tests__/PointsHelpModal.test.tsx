import React from 'react';
import { render, screen, within, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import PointsHelpModal from '../PointsHelpModal';

function expectRowPoints(sectionName: string, label: string, points: string) {
  const section = screen.getByRole('region', { name: sectionName });
  const row = within(section).getByText(label).closest('tr') as HTMLElement;
  expect(within(row).getByText(points)).toBeInTheDocument();
}

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

  test.each([
    ['1st place', '+10'],
    ['2nd place', '+7'],
    ['3rd place', '+4'],
    ['4th place', '+2'],
    ['Submit a game', '+2'],
    ['Verify a game', '+1'],
  ])('Games section: %s awards %s', (label, points) => {
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
    render(<PointsHelpModal onClose={jest.fn()} />);
    expectRowPoints('Tournaments', label, points);
  });

  test('Ranked League section awards qualify points for reaching the leaderboard, not for joining', () => {
    render(<PointsHelpModal onClose={jest.fn()} />);
    expectRowPoints('Ranked League', 'Qualify for the leaderboard', '+10');
    expect(screen.queryByText(/join league/i)).not.toBeInTheDocument();
  });

  test('Ranked League section does not show Coming soon', () => {
    render(<PointsHelpModal onClose={jest.fn()} />);
    expect(screen.queryByText('Coming soon')).not.toBeInTheDocument();
  });

  test('Limits section explains the game caps and that tournament awards are not limited', () => {
    render(<PointsHelpModal onClose={jest.fn()} />);
    const section = screen.getByRole('region', { name: 'Limits' });
    expect(within(section).getByText(/60 points per rolling 24 hours/i)).toBeInTheDocument();
    expect(within(section).getByText(/6 games per 7 days/i)).toBeInTheDocument();
    expect(within(section).getByText(/tournament awards are not limited/i)).toBeInTheDocument();
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
