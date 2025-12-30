import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  const location = useLocation();

  useEffect(() => {
    // Only redirect after auth has finished loading
    if (!authLoading && !isAuthenticated) {
      // If redirecting to login, include the current path as a redirect parameter
      if (redirectTo === '/login' || redirectTo.startsWith('/login')) {
        // Don't add redirect parameter if we're already on the login page
        if (location.pathname === '/login') {
          navigate('/login');
        } else {
          const currentPath = location.pathname + location.search;
          navigate(`/login?redirect=${encodeURIComponent(currentPath)}`);
        }
      } else {
        navigate(redirectTo);
      }
    }
  }, [isAuthenticated, authLoading, navigate, redirectTo, location]);

  return {
    isLoading: authLoading,
    isAuthenticated: isAuthenticated && !authLoading, // Only true if auth is loaded AND user is authenticated
  };
};

