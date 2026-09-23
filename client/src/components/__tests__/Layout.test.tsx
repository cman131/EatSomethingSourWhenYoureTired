import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Layout from '../Layout';
import { usePageBackdrop } from '../../contexts/PageBackdropContext';

jest.mock('react-router-dom', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
  useLocation: () => ({ pathname: '/' }),
  useNavigate: () => jest.fn(),
}));

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: false, logout: jest.fn() }),
}));

jest.mock('../NotificationDropdown', () => () => null);

const BackdropSetter: React.FC<{ node: React.ReactNode }> = ({ node }) => {
  usePageBackdrop(node);
  return null;
};

describe('Layout page backdrop', () => {
  test('renders <main> unchanged when no page registers a backdrop', () => {
    render(
      <Layout>
        <div data-testid="page-content" />
      </Layout>
    );

    const main = screen.getByTestId('layout-main');
    expect(screen.getByTestId('page-content')).toBeInTheDocument();
    expect(main.children).toHaveLength(1);
  });

  test('renders a registered page backdrop inside <main>, before the page content', () => {
    render(
      <Layout>
        <BackdropSetter node={<div data-testid="test-backdrop" />} />
        <div data-testid="page-content" />
      </Layout>
    );

    const main = screen.getByTestId('layout-main');
    expect(screen.getByTestId('test-backdrop')).toBeInTheDocument();
    expect(main.firstElementChild).toBe(screen.getByTestId('test-backdrop'));
  });

  test('clears the backdrop when the registering component unmounts', () => {
    const { rerender } = render(
      <Layout>
        <BackdropSetter node={<div data-testid="test-backdrop" />} />
        <div data-testid="page-content" />
      </Layout>
    );
    expect(screen.getByTestId('test-backdrop')).toBeInTheDocument();

    rerender(
      <Layout>
        <div data-testid="page-content" />
      </Layout>
    );

    expect(screen.queryByTestId('test-backdrop')).not.toBeInTheDocument();
  });
});
