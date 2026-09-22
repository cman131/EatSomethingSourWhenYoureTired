import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import TitleBadge from '../TitleBadge';

describe('TitleBadge', () => {
  test('renders entry titles as the default pale-blue pill', () => {
    render(<TitleBadge value="Nakama" />);

    expect(screen.getByText('Nakama')).toHaveClass('bg-primary-100', 'text-primary-800');
  });

  test('renders unknown titles as the default pill', () => {
    render(<TitleBadge value="Dragon" />);

    expect(screen.getByText('Dragon')).toHaveClass('bg-primary-100');
  });

  test('renders mid titles with the shared silver class', () => {
    render(<TitleBadge value="Over 9000 Han" />);

    const badge = screen.getByText('Over 9000 Han');
    expect(badge).toHaveClass('flair-title-mid');
    expect(badge).not.toHaveClass('bg-primary-100');
  });

  test('renders Tsumo-nami with its own class and wave emoji', () => {
    render(<TitleBadge value="Tsumo-nami" />);

    const badge = screen.getByText('Tsumo-nami');
    expect(badge).toHaveClass('flair-title-tsumonami');
    expect(badge).toHaveTextContent('🌊');
  });

  test('renders existing premium titles with class and emoji', () => {
    const { unmount } = render(<TitleBadge value="Chicken Farmer" />);
    expect(screen.getByText('Chicken Farmer')).toHaveClass('flair-title-chicken');
    expect(screen.getByText('Chicken Farmer')).toHaveTextContent('🐔');
    unmount();

    render(<TitleBadge value="Chombo Chaser" />);
    expect(screen.getByText('Chombo Chaser')).toHaveClass('flair-title-chombo');
    expect(screen.getByText('Chombo Chaser')).toHaveTextContent('⚡');
  });

  test('renders earned titles with the prestige badge', () => {
    render(<TitleBadge value="🏆 Spring Open" />);

    const badge = screen.getByText('🏆 Spring Open');
    expect(badge).toHaveClass('flair-title-prestige');
    expect(badge).not.toHaveClass('bg-primary-100');
  });
});
