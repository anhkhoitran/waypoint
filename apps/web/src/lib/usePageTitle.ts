import { useEffect } from 'react';

export function usePageTitle(title: string) {
  useEffect(() => {
    const previous = document.title;
    document.title = `${title} — Waypoint`;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
