import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProfileBackdrop from '../ProfileBackdrop';

describe('ProfileBackdrop', () => {
  test('renders a decorative banner carrying the backdrop class', () => {
    render(<ProfileBackdrop value="flair-backdrop-fuji" />);

    const banner = screen.getByTestId('profile-backdrop');
    expect(banner).toHaveClass('flair-backdrop-fuji');
    expect(banner).toHaveAttribute('aria-hidden', 'true');
  });

  test('applies extra classes and a custom test id', () => {
    render(<ProfileBackdrop value="flair-backdrop-shoji" className="h-10" testId="preview-backdrop" />);

    expect(screen.getByTestId('preview-backdrop')).toHaveClass('flair-backdrop-shoji', 'h-10');
  });

  test.each([null, undefined, ''])('renders nothing for an empty value (%p)', value => {
    const { container } = render(<ProfileBackdrop value={value} />);

    expect(container).toBeEmptyDOMElement();
  });

  test('renders nothing for a value that is not a known backdrop', () => {
    const { container } = render(<ProfileBackdrop value="text-red-600 hidden" />);

    expect(container).toBeEmptyDOMElement();
  });
});
