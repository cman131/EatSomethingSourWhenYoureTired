import { renderHook, act } from '@testing-library/react';
import { useWinnerTitle } from '../useWinnerTitle';

describe('useWinnerTitle', () => {
  test('starts as the truncated name', () => {
    const { result } = renderHook(() => useWinnerTitle('Spring Open'));

    expect(result.current.winnerTitle).toBe('Spring Open');
  });

  test('follows name changes until the creator edits it', () => {
    const { result, rerender } = renderHook(({ name }) => useWinnerTitle(name), {
      initialProps: { name: 'Spring Open' },
    });

    rerender({ name: 'Spring Open 2026' });
    expect(result.current.winnerTitle).toBe('Spring Open 2026');

    act(() => result.current.setWinnerTitle('Spring Champ'));
    rerender({ name: 'Autumn Open' });

    expect(result.current.winnerTitle).toBe('Spring Champ');
  });

  test('truncates a long name as it follows', () => {
    const { result } = renderHook(() => useWinnerTitle('a'.repeat(60)));

    expect(result.current.winnerTitle).toBe('a'.repeat(30));
  });

  test('caps typed input at the limit', () => {
    const { result } = renderHook(() => useWinnerTitle('x'));

    act(() => result.current.setWinnerTitle('b'.repeat(40)));

    expect(result.current.winnerTitle).toBe('b'.repeat(30));
  });

  test('reset restores a saved custom title and stops following the name', () => {
    const { result, rerender } = renderHook(({ name }) => useWinnerTitle(name), {
      initialProps: { name: '' },
    });

    act(() => result.current.resetWinnerTitle('Spring Open', 'Spring Champ'));
    rerender({ name: 'Spring Open' });
    rerender({ name: 'Renamed Open' });

    expect(result.current.winnerTitle).toBe('Spring Champ');
  });

  test('reset with no saved title follows the name again', () => {
    const { result, rerender } = renderHook(({ name }) => useWinnerTitle(name), {
      initialProps: { name: '' },
    });

    act(() => result.current.setWinnerTitle('Typed'));
    act(() => result.current.resetWinnerTitle('Spring Open', undefined));
    rerender({ name: 'Spring Open' });
    rerender({ name: 'Spring Open 2027' });

    expect(result.current.winnerTitle).toBe('Spring Open 2027');
  });

  test('reset with a saved title equal to the default keeps following the name', () => {
    const { result, rerender } = renderHook(({ name }) => useWinnerTitle(name), {
      initialProps: { name: '' },
    });

    act(() => result.current.resetWinnerTitle('Spring Open', 'Spring Open'));
    rerender({ name: 'Spring Open' });
    rerender({ name: 'Spring Open 2027' });

    expect(result.current.winnerTitle).toBe('Spring Open 2027');
  });
});
