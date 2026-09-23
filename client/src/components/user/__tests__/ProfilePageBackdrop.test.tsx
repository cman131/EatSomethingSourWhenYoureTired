import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProfilePageBackdrop from '../ProfilePageBackdrop';

describe('ProfilePageBackdrop', () => {
  test('renders the full-page layer carrying the backdrop class', () => {
    render(<ProfilePageBackdrop value="flair-backdrop-koi" />);

    const layer = screen.getByTestId('profile-page-backdrop');
    expect(layer).toHaveClass('profile-page-backdrop', 'flair-backdrop-koi');
    expect(layer).toHaveAttribute('aria-hidden', 'true');
  });

  test.each([null, undefined, ''])('renders nothing for an empty value (%p)', value => {
    const { container } = render(<ProfilePageBackdrop value={value} />);

    expect(container).toBeEmptyDOMElement();
  });

  test('renders nothing for a value that is not a known backdrop', () => {
    const { container } = render(<ProfilePageBackdrop value="text-red-600 hidden" />);

    expect(container).toBeEmptyDOMElement();
  });
});
