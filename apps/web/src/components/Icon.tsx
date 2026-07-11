const paths: Record<string, JSX.Element> = {
  waypoint: (
    <>
      <path d="M12 21s-6.5-5.3-6.5-10a6.5 6.5 0 0 1 13 0c0 4.7-6.5 10-6.5 10Z" />
      <circle cx="12" cy="11" r="2.4" />
    </>
  ),
  radar: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 12l6-6" />
      <circle cx="12" cy="12" r="0.5" fill="currentColor" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-8" />
      <path d="M22 20H2" />
    </>
  ),
  map: (
    <>
      <path d="M5 4c4 0 4 5 8 5s4-2 6-2" />
      <path d="M5 12c4 0 5 4 9 4" />
      <circle cx="5" cy="4" r="1.6" />
      <circle cx="19" cy="20" r="1.6" />
      <path d="M14 16c2.5 0 4 1.5 5 4" />
    </>
  ),
  layers: (
    <>
      <path d="M12 3 3 8l9 5 9-5-9-5Z" />
      <path d="M3 13l9 5 9-5" />
    </>
  ),
  kanban: (
    <>
      <rect x="3" y="4" width="5" height="16" rx="1.5" />
      <rect x="10" y="4" width="5" height="10" rx="1.5" />
      <rect x="17" y="4" width="5" height="6" rx="1.5" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  moon: <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z" />,
  sparkle: (
    <>
      <path d="M12 4l1.8 4.6L18.5 10l-4.7 1.4L12 16l-1.8-4.6L5.5 10l4.7-1.4L12 4Z" />
      <path d="M19 16l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2Z" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  bookmark: <path d="M6 4h12v16l-6-4-6 4V4Z" />,
  'bookmark-filled': <path d="M6 4h12v16l-6-4-6 4V4Z" fill="currentColor" />,
  'eye-off': (
    <>
      <path d="M3 3l18 18" />
      <path d="M10.6 5.1A9.9 9.9 0 0 1 12 5c5 0 9 4 10 7-.5 1.3-1.5 2.8-2.9 4.1M6.7 6.7C4.6 8.1 3.1 10 2 12c1 3 5 7 10 7 1.3 0 2.5-.3 3.6-.7" />
      <path d="M9.9 10a3 3 0 0 0 4.1 4.2" />
    </>
  ),
  alert: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5" />
      <circle cx="12" cy="16" r="0.5" fill="currentColor" />
    </>
  ),
  inbox: (
    <>
      <path d="M3 12h4.5l1.5 3h6l1.5-3H21" />
      <path d="M5.5 6h13l2.5 6v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-7l2.5-6Z" />
    </>
  ),
  spinner: (
    <>
      <path d="M12 3a9 9 0 1 0 9 9" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 13a7.97 7.97 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a8 8 0 0 0-1.7-1L14.7 3h-4l-.6 2.9a8 8 0 0 0-1.7 1l-2.5-1-2 3.5L6 11a7.97 7.97 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a8 8 0 0 0 1.7 1l.6 2.9h4l.6-2.9a8 8 0 0 0 1.7-1l2.5 1 2-3.5-2.1-1.6Z" />
    </>
  ),
  minus: <path d="M5 12h14" />,
  plus: <path d="M12 5v14M5 12h14" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  'external-link': (
    <>
      <path d="M14 4h6v6" />
      <path d="M20 4L10 14" />
      <path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6" />
    </>
  ),
};

export type IconName = keyof typeof paths;

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
