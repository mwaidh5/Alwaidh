/**
 * What a person may open in the dashboard.
 *
 * A role still carries its usual bundle — a solar staffer gets solar
 * work without anyone ticking a box. On top of that, any single
 * permission can be handed to any single person from the Users page:
 * an installer who should answer customer messages, say, without
 * becoming staff everywhere else.
 */

export type Permission =
  | 'messages'
  | 'team'
  | 'jobs'
  | 'crm-solar'
  | 'crm-computers'
  | 'products'
  | 'solar-prices'
  | 'blog'
  | 'media'
  | 'orders'
  | 'submissions'
  | 'analytics';

export const PERMISSIONS: { key: Permission; label: string; hint: string }[] = [
  { key: 'messages', label: 'Customer messages', hint: 'Read and answer the website chat' },
  { key: 'team', label: 'Team chat and files', hint: 'The staff room and the shared files' },
  { key: 'jobs', label: 'Solar jobs', hint: 'The installation board' },
  { key: 'crm-solar', label: 'CRM — solar book', hint: 'Solar leads and customers' },
  { key: 'crm-computers', label: 'CRM — computers book', hint: 'Computer leads and customers' },
  { key: 'products', label: 'Products', hint: 'Add and edit the catalogue' },
  { key: 'solar-prices', label: 'Solar prices', hint: 'The price sheets and installments' },
  { key: 'blog', label: 'Articles', hint: 'Write and publish articles' },
  { key: 'media', label: 'Media library', hint: 'Every picture on the site' },
  { key: 'orders', label: 'Orders', hint: 'Customer orders' },
  { key: 'submissions', label: 'Submissions', hint: 'Messages from the contact form' },
  { key: 'analytics', label: 'Analytics', hint: 'Visitor and sales figures' },
];

/** The roles a person can hold, as the settings lists record them. */
export interface RoleFlags {
  isAdmin: boolean;
  isComputerStaff: boolean;
  isSolarStaff: boolean;
  isShopManager: boolean;
  isInstaller: boolean;
  isCrmSolar: boolean;
  isCrmComputers: boolean;
}

/** What each role opens on its own, before any extra permission. */
function fromRoles(r: RoleFlags): Set<Permission> {
  const out = new Set<Permission>();
  const add = (...keys: Permission[]) => keys.forEach((k) => out.add(k));
  if (r.isAdmin) {
    PERMISSIONS.forEach((p) => out.add(p.key));
    return out;
  }
  if (r.isComputerStaff) add('messages', 'team', 'products', 'blog');
  if (r.isSolarStaff) add('messages', 'team', 'products', 'blog', 'jobs', 'solar-prices');
  if (r.isShopManager) add('messages', 'team', 'products', 'blog');
  if (r.isInstaller) add('team', 'jobs');
  if (r.isCrmSolar) add('team', 'crm-solar');
  if (r.isCrmComputers) add('team', 'crm-computers');
  return out;
}

/**
 * Everything this person may open: their role's bundle, plus anything
 * handed to them by name, minus anything taken away by name. An admin
 * keeps everything — the way to remove an admin is to change their role,
 * not to strip them one door at a time.
 */
export function permissionsFor(
  roles: RoleFlags,
  extra: string[] = [],
  denied: string[] = [],
): Set<Permission> {
  const out = fromRoles(roles);
  for (const key of extra) {
    if (PERMISSIONS.some((p) => p.key === key)) out.add(key as Permission);
  }
  if (!roles.isAdmin) for (const key of denied) out.delete(key as Permission);
  return out;
}

/** The extras granted to one person, from the settings map. */
export function extrasFor(
  map: Record<string, string[]> | undefined,
  email: string | null,
): string[] {
  if (!email) return [];
  const list = (map ?? {})[email.toLowerCase()];
  return Array.isArray(list) ? list : [];
}
