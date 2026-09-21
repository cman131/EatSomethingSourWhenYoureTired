import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import UserAvatar from '../UserAvatar';

const userWithBorder = (profileBorder: string) => ({
  displayName: 'Alice',
  avatar: 'https://example.com/alice.png',
  equippedFlair: { nameColor: null, nameIcon: null, profileBorder, title: null },
});

describe('UserAvatar flair borders', () => {
  test.each(['flair-border-hanabi', 'flair-border-kitsune', 'flair-border-yozakura', 'flair-border-rainbow'])(
    'premium border %s wraps the avatar image in the ring element',
    borderClass => {
      render(<UserAvatar user={userWithBorder(borderClass)} />);

      const img = screen.getByRole('img', { name: "Alice's avatar" });
      expect(img).toHaveClass('flair-border-inner');
      // eslint-disable-next-line testing-library/no-node-access -- asserts the avatar image is a child of the ring wrapper
      expect(img.parentElement).toHaveClass(borderClass);
    }
  );

  test('mid border wraps the avatar image in a gradient wrapper', () => {
    render(<UserAvatar user={userWithBorder('flair-mid-torii')} />);

    const img = screen.getByRole('img', { name: "Alice's avatar" });
    expect(img).toHaveClass('flair-border-inner');
    // eslint-disable-next-line testing-library/no-node-access -- asserts the avatar image is a child of the gradient wrapper
    expect(img.parentElement).toHaveClass('flair-mid-torii');
  });

  test('entry ring is applied directly to the image with no wrapper', () => {
    const { container } = render(<UserAvatar user={userWithBorder('flair-ring-manzu')} />);

    const img = screen.getByRole('img', { name: "Alice's avatar" });
    expect(img).toHaveClass('flair-ring-manzu');
    // eslint-disable-next-line testing-library/no-node-access -- asserts the image is the root node (no wrapper)
    expect(container.firstChild).toBe(img);
  });
});
