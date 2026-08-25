import { useEffect, useMemo, useState } from 'react';
import { ADMIN_EMAILS } from '../firebase';
import { useSettings } from './useSettings';
import { listUsers } from './userStore';

/** "ahmed.ali@gmail.com" → "Ahmed Ali", for accounts with no name on file. */
export function prettyHandle(email: string): string {
  const handle = (email.split('@')[0] ?? '').replace(/[._-]+/g, ' ').trim();
  if (!handle) return email;
  return handle.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * A resolver for a person's display name, usable in any component. The
 * admin's name book in settings wins; otherwise a name is built from the
 * email address.
 */
export function useStaffName(): (email: string) => string {
  const settings = useSettings();
  const book = settings.staffNames ?? {};
  return (email: string) => {
    const e = (email ?? '').toLowerCase();
    return book[e] || prettyHandle(e);
  };
}

/** "ahmed.ali@gmail.com" → "ahmed.ali", how people are tagged with @. */
export function handleOf(email: string): string {
  return (email.split('@')[0] || email).toLowerCase();
}

export interface StaffPerson {
  email: string;
  name: string;
  role: string;
}

/**
 * Everyone on the team, from the role lists in settings. Real names come
 * from the user profiles when the signed-in account may read them (admins
 * only), otherwise the name is built from the email address.
 */
export function useStaffDirectory(): StaffPerson[] {
  const settings = useSettings();
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    listUsers()
      .then((list) => {
        if (cancelled) return;
        const map: Record<string, string> = {};
        for (const u of list) {
          const name = (u.displayName ?? '').trim();
          if (u.email && name) map[u.email.toLowerCase()] = name;
        }
        setNames(map);
      })
      .catch(() => {
        /* not allowed to read profiles — email-based names it is */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(() => {
    const roleOf = new Map<string, string>();
    const add = (emails: string[] | undefined, role: string) => {
      for (const raw of emails ?? []) {
        const email = String(raw).toLowerCase().trim();
        if (!email) continue;
        // First role listed wins: admin outranks the rest.
        if (!roleOf.has(email)) roleOf.set(email, role);
      }
    };
    add(ADMIN_EMAILS as unknown as string[], 'Admin');
    add(settings.extraAdminEmails, 'Admin');
    add(settings.computerStaffEmails, 'Computer staff');
    add(settings.solarStaffEmails, 'Solar staff');
    add(settings.shopManagerEmails, 'Shop manager');
    add(settings.installerEmails, 'Installer');

    return [...roleOf.entries()]
      .map(([email, role]) => ({
        email,
        role,
        name: settings.staffNames?.[email] || names[email] || prettyHandle(email),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [settings, names]);
}
