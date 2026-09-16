import type { Permission } from './permissions';
import type { AlertKey } from './useStaffAlerts';

/**
 * The dashboard's pages, in one place: the sidebar on a laptop and the
 * phone's drawer both read this, so a page added here appears in both.
 */

export type Access =
  | 'admin'
  | 'staff'
  | 'jobs'
  | 'crm'
  | 'solar'
  | 'products'
  | 'team'
  | 'orders'
  | 'media'
  | 'blog'
  | 'submissions'
  | 'analytics'
  | 'event';

export interface AdminNavItem {
  to: string;
  label: string;
  end?: boolean;
  access: Access;
  /** Which heading it sits under. */
  group: string;
}

/** Routes that carry a "what's new" badge. */
export const ALERT_FOR: Record<string, AlertKey> = {
  '/admin/jobs': 'jobs',
  '/admin/orders': 'orders',
  '/admin/submissions': 'submissions',
  '/admin/chat': 'chat',
  '/admin/team': 'team',
};

export const ADMIN_NAV: AdminNavItem[] = [
  { to: '/admin', label: 'Overview', end: true, access: 'admin', group: 'Work' },
  { to: '/admin/jobs', label: 'Solar Jobs', access: 'jobs', group: 'Work' },
  { to: '/admin/crm', label: 'CRM', access: 'crm', group: 'Work' },
  { to: '/admin/orders', label: 'Orders', access: 'orders', group: 'Work' },
  { to: '/admin/products', label: 'Products', access: 'products', group: 'Shop' },
  { to: '/admin/prices', label: 'Solar Prices', access: 'solar', group: 'Shop' },
  { to: '/admin/media', label: 'Media', access: 'media', group: 'Shop' },
  { to: '/admin/blog', label: 'Blog', access: 'blog', group: 'Shop' },
  { to: '/admin/chat', label: 'Messages', access: 'staff', group: 'Team' },
  { to: '/admin/team', label: 'Team chat', access: 'team', group: 'Team' },
  { to: '/admin/files', label: 'Files', access: 'team', group: 'Team' },
  { to: '/admin/submissions', label: 'Submissions', access: 'submissions', group: 'Team' },
  // Temporary: the Tiandy event's guest list. Remove with the page after.
  { to: '/admin/event', label: 'Event', access: 'event', group: 'Team' },
  { to: '/admin/users', label: 'Users', access: 'admin', group: 'Manage' },
  { to: '/admin/analytics', label: 'Analytics', access: 'analytics', group: 'Manage' },
  { to: '/admin/settings', label: 'Settings', access: 'admin', group: 'Manage' },
];

/**
 * May this person open a section? An admin opens everything; for anyone
 * else every section is a permission — the role grants its usual bundle,
 * and anything handed out by name on the Users page adds to it.
 */
export function canOpen(access: Access, isAdmin: boolean, can: (p: Permission) => boolean): boolean {
  if (isAdmin) return true;
  switch (access) {
    case 'products':
      return can('products');
    case 'solar':
      return can('solar-prices');
    case 'jobs':
      return can('jobs');
    case 'staff':
      return can('messages');
    case 'crm':
      return can('crm-solar') || can('crm-computers');
    case 'team':
      return can('team');
    case 'orders':
      return can('orders');
    case 'media':
      return can('media');
    case 'blog':
      return can('blog');
    case 'submissions':
      return can('submissions');
    case 'analytics':
      return can('analytics');
    case 'event':
      return can('submissions');
    default:
      return false;
  }
}

export interface NavRoles {
  isAdmin: boolean;
  isSolarStaff: boolean;
  isShopManager: boolean;
  isInstaller: boolean;
}

/**
 * The handful of pages a person opens all day, most wanted first: what
 * the phone's drawer shows at the top before "More". An installer sees
 * their jobs and the team; a salesperson the inbox and the CRM; the
 * owner the overview.
 */
export function favoritePaths(r: NavRoles): string[] {
  if (r.isAdmin) return ['/admin', '/admin/jobs', '/admin/chat', '/admin/crm', '/admin/orders'];
  if (r.isInstaller && !r.isSolarStaff) return ['/admin/jobs', '/admin/team', '/admin/files', '/admin/chat'];
  if (r.isSolarStaff) return ['/admin/jobs', '/admin/chat', '/admin/crm', '/admin/prices', '/admin/team'];
  if (r.isShopManager) return ['/admin/orders', '/admin/chat', '/admin/products', '/admin/crm', '/admin/team'];
  return ['/admin/chat', '/admin/crm', '/admin/orders', '/admin/products', '/admin/team'];
}
