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

  test('an empty color value falls back to the default color class', () => {
    render(<FlairName name="Alice" colorValue="" defaultColorClass="text-gray-900" />);

    expect(screen.getByText('Alice')).toHaveClass('text-gray-900');
  });

  test('the equipped color replaces the default color class', () => {
    render(<FlairName name="Alice" colorValue="flair-color-pink" defaultColorClass="text-gray-900" />);

    const name = screen.getByText('Alice');
    expect(name).toHaveClass('flair-color-pink');
    expect(name).not.toHaveClass('text-gray-900');
  });

  test.each(['flair-color-matcha', 'flair-color-fuji'])('%s renders no sparkles', colorValue => {
    const { container } = render(<FlairName name="Alice" colorValue={colorValue} />);

    expect(screen.getByText('Alice')).toHaveClass(colorValue);
    expect(sparkles(container)).toHaveLength(0);
  });

  test('non-premium output has no sparkle wrapper', () => {
    const { container } = render(<FlairName name="Alice" colorValue="flair-color-fuji" />);

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- the wrapper is a class-only span with no role or text
    expect(container.querySelector('.flair-sparkle-wrap')).toBeNull();
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

    // A sparkle glyph nested inside the name span would add "✦" to its text.
    expect(screen.getByText('Alice')).toHaveTextContent(/^Alice$/);
  });

  test.each([
    ['flair-color-gold', 'flair-sparkles-gold'],
    ['flair-color-red', 'flair-sparkles-crimson'],
    ['flair-color-neon', 'flair-sparkles-neon'],
    ['flair-color-tanabata', 'flair-sparkles-tanabata'],
  ])('%s uses the %s sparkle palette', (colorValue, palette) => {
    const { container } = render(<FlairName name="Alice" colorValue={colorValue} />);

    const found = sparkles(container);
    expect(found).toHaveLength(3);
    found.forEach(sparkle => {
      expect(sparkle).toHaveClass(palette);
    });
  });

  test('a premium color ignores the default color class', () => {
    const { container } = render(
      <FlairName name="Alice" colorValue="flair-color-gold" defaultColorClass="text-gray-900" />
    );

    const name = screen.getByText('Alice');
    expect(name).toHaveClass('flair-color-gold');
    expect(name).not.toHaveClass('text-gray-900');
    expect(sparkles(container)).toHaveLength(3);
  });

  test('compact mode drops the top-middle sparkle', () => {
    const { container } = render(<FlairName name="Alice" colorValue="flair-color-gold" compact />);

    const found = sparkles(container);
    expect(found).toHaveLength(2);
    expect(Array.from(found).some(sparkle => sparkle.classList.contains('flair-sparkle-tm'))).toBe(false);
  });

  test('compact mode with a non-premium color renders just the name span', () => {
    const { container } = render(<FlairName name="Alice" colorValue="flair-color-fuji" compact />);

    expect(sparkles(container)).toHaveLength(0);
    // eslint-disable-next-line testing-library/no-node-access -- asserting the name span is the root element
    expect(container.firstChild).toBe(screen.getByText('Alice'));
  });

  test('unknown legacy color values are applied as-is without sparkles', () => {
    const { container } = render(<FlairName name="Alice" colorValue="text-emerald-600" />);

    expect(screen.getByText('Alice')).toHaveClass('text-emerald-600');
    expect(sparkles(container)).toHaveLength(0);
  });
});
