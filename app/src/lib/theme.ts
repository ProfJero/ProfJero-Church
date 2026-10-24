import { useEffect, useState } from 'react';

export type ThemePref = 'light' | 'dark' | 'system';
const KEY = 'cwc-theme';

function read(): ThemePref {
  try {
    return (localStorage.getItem(KEY) as ThemePref) || 'system';
  } catch {
    return 'system';
  }
}

function apply(pref: ThemePref) {
  const dark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    if (pref !== 'system') m.setAttribute('content', dark ? '#0b1020' : '#1e3a8a');
  });
}

const listeners = new Set<(p: ThemePref) => void>();

export function setTheme(pref: ThemePref) {
  try {
    localStorage.setItem(KEY, pref);
  } catch {
    /* private mode */
  }
  apply(pref);
  listeners.forEach((l) => l(pref));
}

export function useTheme(): [ThemePref, (p: ThemePref) => void] {
  const [pref, setPref] = useState<ThemePref>(read);
  useEffect(() => {
    listeners.add(setPref);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => read() === 'system' && apply('system');
    mq.addEventListener('change', onChange);
    return () => {
      listeners.delete(setPref);
      mq.removeEventListener('change', onChange);
    };
  }, []);
  return [pref, setTheme];
}
