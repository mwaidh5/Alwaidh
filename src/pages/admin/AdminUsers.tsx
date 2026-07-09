import { useEffect, useState } from 'react';
import {
  createInvitedUser,
  deleteUser,
  listUsers,
  setUserDisabled,
  setUserRole,
  type AppUser,
} from '../../lib/userStore';
import { ADMIN_EMAILS } from '../../firebase';
import { loadSettings, saveSettings, type SiteSettings } from '../../lib/settingsStore';

const ROLES: AppUser['role'][] = ['admin', 'computer-staff', 'solar-staff', 'customer'];

const ROLE_LABELS: Record<AppUser['role'], string> = {
  admin: 'Admin — full access',
  'computer-staff': 'Computer staff — computers & cameras',
  'solar-staff': 'Solar staff — solar, prices & jobs',
  customer: 'Customer',
};

/** The role that is actually enforced, derived from the settings email lists. */
function effectiveRole(email: string, settings: SiteSettings | null): AppUser['role'] {
  const e = email.toLowerCase();
  if (ADMIN_EMAILS.includes(e)) return 'admin';
  if (!settings) return 'customer';
  if (settings.extraAdminEmails.includes(e)) return 'admin';
  if (settings.computerStaffEmails.includes(e)) return 'computer-staff';
  if (settings.solarStaffEmails.includes(e)) return 'solar-staff';
  return 'customer';
}

/** Rebuild the settings email lists so `email` appears only under `role`. */
function withRoleAssigned(s: SiteSettings, email: string, role: AppUser['role']): SiteSettings {
  const e = email.toLowerCase();
  const without = (list: string[]) => list.filter((x) => x !== e);
  const next: SiteSettings = {
    ...s,
    extraAdminEmails: without(s.extraAdminEmails),
    computerStaffEmails: without(s.computerStaffEmails),
    solarStaffEmails: without(s.solarStaffEmails),
  };
  if (role === 'admin') next.extraAdminEmails = [...next.extraAdminEmails, e];
  if (role === 'computer-staff') next.computerStaffEmails = [...next.computerStaffEmails, e];
  if (role === 'solar-staff') next.solarStaffEmails = [...next.solarStaffEmails, e];
  return next;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<AppUser[] | null>(null);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<AppUser['role']>('customer');
  const [inviting, setInviting] = useState(false);

  const [extraEmailInput, setExtraEmailInput] = useState('');

  // Role edits are staged here per user until the admin presses Save.
  const [pendingRoles, setPendingRoles] = useState<Record<string, AppUser['role']>>({});
  const [savingUid, setSavingUid] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listUsers(), loadSettings()])
      .then(([u, s]) => {
        if (cancelled) return;
        setUsers(u);
        setSettings(s);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load.');
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setError('');
    setInviting(true);
    try {
      await createInvitedUser({
        email: inviteEmail.trim(),
        displayName: inviteName.trim() || undefined,
        role: inviteRole,
      });
      if (settings && inviteRole !== 'customer') {
        const next = withRoleAssigned(settings, inviteEmail.trim(), inviteRole);
        await saveSettings(next);
        setSettings(next);
      }
      setInviteEmail('');
      setInviteName('');
      setInviteRole('customer');
      setRefresh((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invite failed.');
    } finally {
      setInviting(false);
    }
  }

  function stageRole(u: AppUser, role: AppUser['role']) {
    setError('');
    setPendingRoles((prev) => {
      const next = { ...prev };
      if (role === effectiveRole(u.email, settings)) delete next[u.uid];
      else next[u.uid] = role;
      return next;
    });
  }

  function cancelRole(uid: string) {
    setPendingRoles((prev) => {
      const next = { ...prev };
      delete next[uid];
      return next;
    });
  }

  async function handleSaveRole(u: AppUser) {
    const role = pendingRoles[u.uid];
    if (!settings || !role) return;
    if (ADMIN_EMAILS.includes(u.email.toLowerCase()) && role !== 'admin') {
      setError(`${u.email} is the built-in owner account and always stays admin.`);
      cancelRole(u.uid);
      return;
    }
    setError('');
    setSavingUid(u.uid);
    try {
      // The settings lists are what the app and security rules actually check;
      // the user-doc role is kept in sync for display.
      const next = withRoleAssigned(settings, u.email, role);
      await saveSettings(next);
      setSettings(next);
      await setUserRole(u.uid, role);
      cancelRole(u.uid);
      setRefresh((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed.');
    } finally {
      setSavingUid(null);
    }
  }

  async function handleToggleDisabled(u: AppUser) {
    try {
      await setUserDisabled(u.uid, !u.disabled);
      setRefresh((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed.');
    }
  }

  async function handleDelete(uid: string) {
    if (!confirm('Remove this user record? (They can still sign in if their email is allowed.)')) return;
    try {
      await deleteUser(uid);
      setRefresh((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed.');
    }
  }

  async function handleAddExtraAdmin() {
    if (!settings) return;
    const email = extraEmailInput.trim().toLowerCase();
    if (!email) return;
    if (settings.extraAdminEmails.includes(email)) {
      setExtraEmailInput('');
      return;
    }
    const next = {
      ...settings,
      extraAdminEmails: [...settings.extraAdminEmails, email],
    };
    setSettings(next);
    setExtraEmailInput('');
    try {
      await saveSettings(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    }
  }

  async function handleRemoveExtraAdmin(email: string) {
    if (!settings) return;
    const next = {
      ...settings,
      extraAdminEmails: settings.extraAdminEmails.filter((e) => e !== email),
    };
    setSettings(next);
    try {
      await saveSettings(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold text-slate-900">Users</h1>
        <p className="mt-1 text-sm text-slate-600">
          {users ? `${users.length} total` : 'Loading…'}
        </p>
      </header>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <div className="card p-5">
        <h2 className="text-base font-bold text-slate-900">Invite / add a user</h2>
        <p className="mt-1 text-xs text-slate-500">
          Adds a record to the user list. To actually grant sign-in, the email must match what
          the user signs in with via Google.
        </p>
        <form onSubmit={handleInvite} className="mt-3 grid gap-3 sm:grid-cols-[1fr,1fr,auto,auto]">
          <input
            type="email"
            required
            placeholder="email@example.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            className="input"
          />
          <input
            type="text"
            placeholder="Display name (optional)"
            value={inviteName}
            onChange={(e) => setInviteName(e.target.value)}
            className="input"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as AppUser['role'])}
            className="input"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          <button type="submit" disabled={inviting} className="btn-primary">
            {inviting ? 'Adding…' : 'Add user'}
          </button>
        </form>
      </div>

      <div className="card p-5">
        <h2 className="text-base font-bold text-slate-900">Admin access</h2>
        <p className="mt-1 text-xs text-slate-500">
          Built-in admins (from <code>firebase.ts</code>): {ADMIN_EMAILS.join(', ')}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(settings?.extraAdminEmails ?? []).map((email) => (
            <span
              key={email}
              className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-800"
            >
              {email}
              <button
                type="button"
                onClick={() => handleRemoveExtraAdmin(email)}
                className="text-brand-700 hover:text-brand-900"
                aria-label={`Remove ${email}`}
              >
                ✕
              </button>
            </span>
          ))}
          {(settings?.extraAdminEmails ?? []).length === 0 && (
            <span className="text-xs text-slate-500">No additional admin emails yet.</span>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            type="email"
            placeholder="add admin email"
            value={extraEmailInput}
            onChange={(e) => setExtraEmailInput(e.target.value)}
            className="input max-w-xs"
          />
          <button type="button" onClick={handleAddExtraAdmin} className="btn-secondary">
            Add admin
          </button>
        </div>
      </div>

      {users === null ? (
        <p className="text-center text-sm text-slate-500">Loading…</p>
      ) : users.length === 0 ? (
        <p className="card p-10 text-center text-sm text-slate-500">
          No user records yet. Users will appear here after their first sign-in.
        </p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Last seen</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {users.map((u) => (
                <tr key={u.uid}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {u.photoURL ? (
                        <img
                          src={u.photoURL}
                          alt=""
                          className="h-9 w-9 rounded-full"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-600 text-xs font-bold text-white">
                          {(u.displayName || u.email).charAt(0).toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">
                          {u.displayName || u.email}
                        </p>
                        <p className="text-xs text-slate-500">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={pendingRoles[u.uid] ?? effectiveRole(u.email, settings)}
                        onChange={(e) => stageRole(u, e.target.value as AppUser['role'])}
                        className="input"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
                      {pendingRoles[u.uid] && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleSaveRole(u)}
                            disabled={savingUid === u.uid}
                            className="btn-primary px-3 py-1.5 text-xs"
                          >
                            {savingUid === u.uid ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            type="button"
                            onClick={() => cancelRole(u.uid)}
                            disabled={savingUid === u.uid}
                            className="text-xs font-semibold text-slate-500 hover:underline"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {new Date(u.lastSeenAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        u.disabled ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {u.disabled ? 'Disabled' : 'Active'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleToggleDisabled(u)}
                      className="text-sm font-semibold text-slate-700 hover:underline"
                    >
                      {u.disabled ? 'Enable' : 'Disable'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(u.uid)}
                      className="ml-3 text-sm font-semibold text-red-700 hover:underline"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
