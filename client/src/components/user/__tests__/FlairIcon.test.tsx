import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import FlairIcon from '../FlairIcon';

// eslint-disable-next-line testing-library/no-node-access -- the wrapper is an aria-hidden span with no role or text
const wrapperOf = (glyph: string) => screen.getByText(glyph).parentElement;

describe('FlairIcon', () => {
  test('wraps the emoji in an aria-hidden span', () => {
    render(<FlairIcon value="🐉" />);

    expect(screen.getByText('🐉')).toHaveClass('flair-icon-glyph');
    expect(wrapperOf('🐉')).toHaveClass('flair-icon');
    expect(wrapperOf('🐉')).toHaveAttribute('aria-hidden', 'true');
  });

  test('entry icons get no tier class', () => {
    render(<FlairIcon value="🍙" />);

    expect(wrapperOf('🍙')).toHaveAttribute('class', 'flair-icon');
  });

  test('unknown icons get only the base class', () => {
    render(<FlairIcon value="🤖" />);

    expect(wrapperOf('🤖')).toHaveAttribute('class', 'flair-icon');
  });

  test('mid icons get the shared glow class', () => {
    render(<FlairIcon value="🦊" />);

    expect(wrapperOf('🦊')).toHaveClass('flair-icon-glow');
  });

  test('premium icons get their own class', () => {
    render(<FlairIcon value="🥷" />);

    expect(wrapperOf('🥷')).toHaveClass('flair-icon-ninja');
  });

  test('appends extra classes from the caller', () => {
    render(<FlairIcon value="🔥" className="mr-1 text-sm" />);

    expect(wrapperOf('🔥')).toHaveClass('flair-icon', 'flair-icon-flame', 'mr-1', 'text-sm');
  });
});
