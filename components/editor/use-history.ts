"use client";

import { useCallback, useRef, useState } from "react";

const LIMIT = 100;

/**
 * Undo/redo history. `commit(next, key)` with the same `key` within 800 ms
 * replaces the current entry instead of pushing, so typing a heading is one
 * undo step rather than one per keystroke.
 */
export function useHistory<T>(initial: T) {
  const [state, setState] = useState<{ past: T[]; present: T; future: T[] }>({ past: [], present: initial, future: [] });
  const last = useRef<{ key: string | null; at: number }>({ key: null, at: 0 });

  const commit = useCallback((next: T | ((prev: T) => T), key: string | null = null) => {
    setState((s) => {
      const value = typeof next === "function" ? (next as (p: T) => T)(s.present) : next;
      if (value === s.present) return s;
      const now = Date.now();
      const coalesce = key !== null && last.current.key === key && now - last.current.at < 800;
      last.current = { key, at: now };
      return coalesce ? { ...s, present: value, future: [] } : { past: [...s.past, s.present].slice(-LIMIT), present: value, future: [] };
    });
  }, []);

  const undo = useCallback(() => {
    last.current.key = null;
    setState((s) => (s.past.length ? { past: s.past.slice(0, -1), present: s.past[s.past.length - 1], future: [s.present, ...s.future] } : s));
  }, []);
  const redo = useCallback(() => {
    last.current.key = null;
    setState((s) => (s.future.length ? { past: [...s.past, s.present], present: s.future[0], future: s.future.slice(1) } : s));
  }, []);
  const reset = useCallback((value: T) => setState({ past: [], present: value, future: [] }), []);

  return { value: state.present, commit, undo, redo, reset, canUndo: state.past.length > 0, canRedo: state.future.length > 0 };
}
