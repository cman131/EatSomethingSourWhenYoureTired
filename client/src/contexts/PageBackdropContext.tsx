import React, { createContext, useContext, useEffect, ReactNode } from 'react';

// Lets a page register a background node with Layout's <main> without Layout needing to know
// anything about what that node is. The default no-op setter means a component can call
// usePageBackdrop safely even in tests that render it without a <Layout> ancestor.
export const PageBackdropContext = createContext<(node: ReactNode) => void>(() => {});

// Callers must pass a stable `node` (e.g. wrap it in useMemo keyed on its real inputs) — a new
// element reference every render would re-register on every render, and since Layout holding new
// state re-renders its children, that would re-run this effect every render too.
export const usePageBackdrop = (node: ReactNode) => {
  const setBackdrop = useContext(PageBackdropContext);

  useEffect(() => {
    setBackdrop(node);
    return () => setBackdrop(null);
  }, [node, setBackdrop]);
};
