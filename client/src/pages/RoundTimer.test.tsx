import React from 'react';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RoundTimer from './RoundTimer';

function renderWithParams(startDate: string, duration: number) {
  const params = `startDate=${encodeURIComponent(startDate)}&duration=${duration}`;
  return render(
    <MemoryRouter initialEntries={[`/round-timer?${params}`]}>
      <Routes>
        <Route path="/round-timer" element={<RoundTimer />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('RoundTimer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('displays time remaining when round is in progress', () => {
    const now = new Date('2024-01-01T10:00:00.000Z');
    jest.setSystemTime(now);

    // Round started 1 hour ago, 90-minute duration → 30 minutes remaining
    const startDate = new Date('2024-01-01T09:00:00.000Z').toISOString();
    renderWithParams(startDate, 90);

    expect(screen.getByText(/30:00/)).toBeInTheDocument();
  });

  test('displays overtime in red when past end time', () => {
    const now = new Date('2024-01-01T10:00:00.000Z');
    jest.setSystemTime(now);

    // Round started 95 minutes ago, 90-minute duration → 5 minutes overtime
    const startDate = new Date('2024-01-01T08:25:00.000Z').toISOString();
    renderWithParams(startDate, 90);

    const timerEl = screen.getByText(/-5:00/);
    expect(timerEl).toBeInTheDocument();
    expect(timerEl).toHaveClass('text-red-600');
  });

  test('updates countdown every second', () => {
    const now = new Date('2024-01-01T10:00:00.000Z');
    jest.setSystemTime(now);

    // Round started 1 hour ago, 90-minute duration → 30:00 remaining
    const startDate = new Date('2024-01-01T09:00:00.000Z').toISOString();
    renderWithParams(startDate, 90);

    expect(screen.getByText(/30:00/)).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(screen.getByText(/29:59/)).toBeInTheDocument();
  });

  test('renders without authentication', () => {
    const now = new Date('2024-01-01T10:00:00.000Z');
    jest.setSystemTime(now);

    const startDate = new Date('2024-01-01T09:30:00.000Z').toISOString();
    // Should not throw even without AuthProvider wrapper
    expect(() => renderWithParams(startDate, 90)).not.toThrow();
  });

  test('shows fallback message when params are missing', () => {
    render(
      <MemoryRouter initialEntries={['/round-timer']}>
        <Routes>
          <Route path="/round-timer" element={<RoundTimer />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/invalid/i)).toBeInTheDocument();
  });
});
