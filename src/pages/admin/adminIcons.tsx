/**
 * One line icon per dashboard page, drawn in the current text colour.
 *
 * Emoji used to mark the pages — a different shape, weight and colour on
 * every phone, and coloured in a dashboard that is otherwise ink on
 * white. These are the same 1.8-stroke outlines the shop's bar uses, so
 * the sidebar, the phone bar and the menu finally look like one set.
 */
const stroke = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

type Draw = () => JSX.Element;

const ICONS: Record<string, Draw> = {
  '/admin': () => (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </>
  ),
  '/admin/jobs': () => (
    <>
      <path d="M14.5 6.5a4 4 0 0 0 5 5L9 22l-3-3L16.5 8.5" />
      <path d="M14.5 6.5 17 4l3 3-2.5 2.5" />
    </>
  ),
  '/admin/crm': () => (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="11" r="2" />
      <path d="M6 16c.5-1.5 1.7-2.2 3-2.2s2.5.7 3 2.2M14.5 10h3.5M14.5 13.5h3.5" />
    </>
  ),
  '/admin/orders': () => (
    <>
      <path d="M6 3h12v18l-2-1.5L14 21l-2-1.5L10 21l-2-1.5L6 21V3Z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  '/admin/products': () => (
    <>
      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
      <path d="M12 12l8-4.5M12 12v9M12 12 4 7.5" />
    </>
  ),
  '/admin/prices': () => (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
    </>
  ),
  '/admin/media': () => (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m21 16-5-5-8 8" />
    </>
  ),
  '/admin/blog': () => (
    <>
      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
      <path d="m13.5 8.5 3 3" />
    </>
  ),
  '/admin/chat': () => (
    <path d="M20 12a7.5 7.5 0 0 1-7.8 7.5c-1 0-2-.2-2.9-.5L4 20.5l1.5-4.6A7.5 7.5 0 1 1 20 12Z" />
  ),
  '/admin/team': () => (
    <>
      <path d="M14 15.5a6 6 0 0 0 5.5-5.7A6 6 0 0 0 8 8.3" />
      <path d="M4 20l1.2-3.5A5.5 5.5 0 1 1 7.5 19c-.8 0-1.6-.2-2.3-.5L4 20Z" />
    </>
  ),
  '/admin/files': () => (
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
  ),
  '/admin/submissions': () => (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
  '/admin/users': () => (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-5.2 6-5.2s6 1.9 6 5.2" />
      <path d="M16 4.5a3.2 3.2 0 0 1 0 6.4M17.5 14.8c2.1.6 3.5 2.2 3.5 4.7" />
    </>
  ),
  '/admin/analytics': () => (
    <>
      <path d="M4 20V4" />
      <path d="M4 20h16" />
      <path d="m7 15 4-5 3 3 5-7" />
    </>
  ),
  '/admin/settings': () => (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" />
    </>
  ),
};

const Dots: Draw = () => (
  <>
    <circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none" />
  </>
);

/** The icon for a dashboard path; three dots for anything unknown. */
export function AdminIcon({ to, size = 22 }: { to: string; size?: number }) {
  const Draw = ICONS[to] ?? Dots;
  return (
    <svg {...stroke} width={size} height={size} aria-hidden="true">
      <Draw />
    </svg>
  );
}

export function MoreIcon({ size = 22 }: { size?: number }) {
  return (
    <svg {...stroke} width={size} height={size} aria-hidden="true">
      <Dots />
    </svg>
  );
}
