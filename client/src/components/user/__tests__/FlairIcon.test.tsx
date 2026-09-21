import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import FlairIcon from '../FlairIcon';

/* eslint-disable testing-library/no-node-access -- the wrapper is an aria-hidden span with no role or text; parentElement is the only way to reach it */

describe('FlairIcon', () => {
  test('wraps the emoji in an aria-hidden span', () => {
    render(<FlairIcon value="🐉" />);

    const glyph = screen.getByText('🐉');
    expect(glyph).toHaveClass('flair-icon-glyph');
    expect(glyph.parentElement).toHaveClass('flair-icon');
    expect(glyph.parentElement).toHaveAttribute('aria-hidden', 'true');
  });

  test('entry icons get no tier class', () => {
    render(<FlairIcon value="🍙" />);

    expect(screen.getByText('🍙').parentElement).toHaveAttribute('class', 'flair-icon');
  });

  test('mid icons get the shared glow class', () => {
    render(<FlairIcon value="🦊" />);

    expect(screen.getByText('🦊').parentElement).toHaveClass('flair-icon-glow');
  });

  test('premium icons get their own class', () => {
    render(<FlairIcon value="🥷" />);

    expect(screen.getByText('🥷').parentElement).toHaveClass('flair-icon-ninja');
  });

  test('appends extra classes from the caller', () => {
    render(<FlairIcon value="🔥" className="mr-1 text-sm" />);

    const wrapper = screen.getByText('🔥').parentElement;
    expect(wrapper).toHaveClass('flair-icon', 'flair-icon-flame', 'mr-1', 'text-sm');
  });
});
