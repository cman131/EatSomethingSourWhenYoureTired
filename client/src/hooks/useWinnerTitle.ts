import { useCallback, useEffect, useState } from 'react';
import { WINNER_TITLE_MAX_LENGTH, defaultWinnerTitle } from '../utils/winnerTitle';

// Form state for the tournament's winner title. It mirrors the truncated tournament name until the
// creator types their own value, after which it is left alone.
export function useWinnerTitle(name: string) {
  const [winnerTitle, setWinnerTitleState] = useState(() => defaultWinnerTitle(name));
  const [edited, setEdited] = useState(false);

  useEffect(() => {
    if (!edited) {
      setWinnerTitleState(defaultWinnerTitle(name));
    }
  }, [name, edited]);

  const setWinnerTitle = useCallback((value: string) => {
    setEdited(true);
    setWinnerTitleState(value.slice(0, WINNER_TITLE_MAX_LENGTH));
  }, []);

  // Loads a saved tournament: a custom title is kept, anything else keeps following the name.
  const resetWinnerTitle = useCallback((savedName: string, savedTitle?: string) => {
    const saved = savedTitle?.trim() ?? '';
    const fallback = defaultWinnerTitle(savedName);
    setEdited(saved !== '' && saved !== fallback);
    setWinnerTitleState(saved || fallback);
  }, []);

  return { winnerTitle, setWinnerTitle, resetWinnerTitle };
}
