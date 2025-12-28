import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * Hook that requires authentication for a page
 * Redirects to login if not authenticated (after auth finishes loading)
 * 
 * @param redirectTo - Path to redirect to if not authenticated (default: '/login')
 * @returns Object with isLoading and isAuthenticated states
 */
export const useRequireAuth = (redirectTo = '/login') => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Only redirect after auth has finished loading
    if (!authLoading && !isAuthenticated) {
      navigate(redirectTo);
    }
  }, [isAuthenticated, authLoading, navigate, redirectTo]);

  return {
    isLoading: authLoading,
    isAuthenticated: isAuthenticated && !authLoading, // Only true if auth is loaded AND user is authenticated
  };
};

