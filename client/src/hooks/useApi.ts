import { useState, useEffect, useCallback, useRef } from 'react';
import { PaginatedResponse } from '../services/api';

// Generic hook for API calls
export const useApi = <T>(
  apiCall: () => Promise<T>,
  dependencies: any[] = []
) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const apiCallRef = useRef(apiCall);

  // Keep the ref up to date
  useEffect(() => {
    apiCallRef.current = apiCall;
  }, [apiCall]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiCallRef.current();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);

  const refetch = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch };
};

// Hook for paginated data
export const usePaginatedApi = <T>(
  apiCall: (page: number, limit: number) => Promise<PaginatedResponse<T>>,
  initialPage = 1,
  initialLimit = 10
) => {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: initialPage,
    limit: initialLimit,
    total: 0,
    pages: 0,
  });

  // Use ref to store the latest apiCall function without causing re-renders
  const apiCallRef = useRef(apiCall);
  const hasInitializedRef = useRef(false);
  const isFetchingRef = useRef(false);
  
  const fetchData = useCallback(async (page = initialPage, limit = initialLimit) => {
    // Prevent concurrent fetches
    if (isFetchingRef.current) {
      return;
    }
    
    try {
      isFetchingRef.current = true;
      setLoading(true);
      setError(null);
      const result = await apiCallRef.current(page, limit);
      
      // Extract data and pagination info
      setData(result.data.items);
      setPagination(result.data.pagination);
      hasInitializedRef.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      hasInitializedRef.current = true;
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [initialPage, initialLimit]);

  // Keep the ref up to date and refetch if apiCall changes after initialization
  useEffect(() => {
    const prevApiCall = apiCallRef.current;
    apiCallRef.current = apiCall;
    
    // Only refetch if apiCall actually changed and we're not already fetching
    if (hasInitializedRef.current && prevApiCall !== apiCall && !isFetchingRef.current) {
      fetchData(initialPage, initialLimit);
    }
  }, [apiCall, initialPage, initialLimit, fetchData]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = useCallback(() => {
    fetchData(pagination.page, pagination.limit);
  }, [fetchData, pagination.page, pagination.limit]);

  const loadPage = useCallback((page: number) => {
    fetchData(page, pagination.limit);
  }, [fetchData, pagination.limit]);

  const changeLimit = useCallback((limit: number) => {
    fetchData(1, limit);
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    pagination,
    refetch,
    loadPage,
    changeLimit,
  };
};

// Hook for mutations (POST, PUT, DELETE)
export const useMutation = <T, P = any>(
  mutationFn: (params: P) => Promise<T>
) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<T | null>(null);

  const mutate = useCallback(async (params: P) => {
    try {
      setLoading(true);
      setError(null);
      const result = await mutationFn(params);
      setData(result);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [mutationFn]);

  const reset = useCallback(() => {
    setError(null);
    setData(null);
  }, []);

  return {
    mutate,
    loading,
    error,
    data,
    reset,
  };
};

