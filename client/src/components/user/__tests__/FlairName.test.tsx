import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import FlairName from '../FlairName';

// Sparkles are decorative and aria-hidden, so they cannot be found by role or text.
// eslint-disable-next-line testing-library/no-node-access -- decorative sparkles are aria-hidden
const sparkles = (container: HTMLElement) => container.querySelectorAll('.flair-sparkle');

describe('FlairName', () => {
  test('renders the plain name with no class when nothing is equipped', () => {
    const { container } = render(<FlairName name="Alice" />);

    expect(screen.getByText('Alice')).not.toHaveAttribute('class');
    expect(sparkles(container)).toHaveLength(0);
  });

  test('applies the default color class when no color is equipped', () => {
    render(<FlairName name="Alice" colorValue={null} defaultColorClass="text-gray-900" />);

    expect(screen.getByText('Alice')).toHaveClass('text-gray-900');
  });

  test('the equipped color replaces the default color class', () => {
    render(<FlairName name="Alice" colorValue="flair-color-pink" defaultColorClass="text-gray-900" />);

    const name = screen.getByText('Alice');
    expect(name).toHaveClass('flair-color-pink');
    expect(name).not.toHaveClass('text-gray-900');
  });

  test('entry and mid colors render no sparkles', () => {
    // eslint-disable-next-line testing-library/render-result-naming-convention -- two renders in one test need distinct names
    const entry = render(<FlairName name="Alice" colorValue="flair-color-matcha" />);
    expect(sparkles(entry.container)).toHaveLength(0);
    entry.unmount();

    // eslint-disable-next-line testing-library/render-result-naming-convention -- two renders in one test need distinct names
    const mid = render(<FlairName name="Alice" colorValue="flair-color-fuji" />);
    expect(screen.getByText('Alice')).toHaveClass('flair-color-fuji');
    expect(sparkles(mid.container)).toHaveLength(0);
  });

  test('premium colors render three aria-hidden sparkles in their palette', () => {
    const { container } = render(<FlairName name="Alice" colorValue="flair-color-gold" />);

    const name = screen.getByText('Alice');
    expect(name).toHaveClass('flair-color-gold');
    // eslint-disable-next-line testing-library/no-node-access -- checking wrapper ancestry of the name span
    expect(name.closest('.flair-sparkle-wrap')).toBeInTheDocument();

    const found = sparkles(container);
    expect(found).toHaveLength(3);
    found.forEach(sparkle => {
      expect(sparkle).toHaveAttribute('aria-hidden', 'true');
      expect(sparkle).toHaveClass('flair-sparkles-gold');
      expect(sparkle).toHaveTextContent('✦');
    });
  });

  test('sparkles are siblings of the gradient span, never children of it', () => {
    render(<FlairName name="Alice" colorValue="flair-color-neon" />);

    // eslint-disable-next-line testing-library/prefer-presence-queries, testing-library/no-node-access -- the name is present; asserting no nested sparkle
    expect(screen.getByText('Alice').querySelector('.flair-sparkle')).toBeNull();
  });

  test.each([
    ['flair-color-gold', 'flair-sparkles-gold'],
    ['flair-color-red', 'flair-sparkles-crimson'],
    ['flair-color-neon', 'flair-sparkles-neon'],
    ['flair-color-tanabata', 'flair-sparkles-tanabata'],
  ])('%s uses the %s sparkle palette', (colorValue, palette) => {
    const { container } = render(<FlairName name="Alice" colorValue={colorValue} />);

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- decorative sparkle is aria-hidden
    expect(container.querySelector('.flair-sparkle')).toHaveClass(palette);
  });

  test('compact mode drops the top-middle sparkle', () => {
    const { container } = render(<FlairName name="Alice" colorValue="flair-color-gold" compact />);

    expect(sparkles(container)).toHaveLength(2);
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- decorative sparkle is aria-hidden
    expect(container.querySelector('.flair-sparkle-tm')).toBeNull();
  });

  test('unknown legacy color values are applied as-is without sparkles', () => {
    const { container } = render(<FlairName name="Alice" colorValue="text-emerald-600" />);

    expect(screen.getByText('Alice')).toHaveClass('text-emerald-600');
    expect(sparkles(container)).toHaveLength(0);
  });
});
