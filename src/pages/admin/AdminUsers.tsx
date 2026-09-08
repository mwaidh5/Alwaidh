import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  createInvitedUser,
  deleteUser,
  listUsers,
  setUserDisabled,
  setUserName,
  setUserRole,
  type AppUser,
} from '../../lib/userStore';
import { ADMIN_EMAILS } from '../../firebase';
import { loadSettings, saveSettings, updateSettingsField, type SiteSettings } from '../../lib/settingsStore';
import { PERMISSIONS, extrasFor, permissionsFor } from '../../lib/permissions';

const ROLES: AppUser['role'][] = [
  'admin',
  'computer-staff',
  'solar-staff',
  'full-staff',
  'shop-manager',
  'installer',
  'customer',
];

const ROLE_LABELS: Record<AppUser['role'], string> = {
  admin: 'Admin — full access',
  'computer-staff': 'Computer staff — computers & cameras',
  'solar-staff': 'Solar staff — solar, prices & jobs',
  'full-staff': 'Full staff — computers, cameras & solar',
  'shop-manager': 'Shop manager — the whole shop, no solar jobs',
  installer: 'Installer — only the jobs assigned to them',
  customer: 'Customer',
};

/** The role that is actually enforced, derived from the settings email lists. */
function effectiveRole(email: string, settings: SiteSettings | null): AppUser['role'] {
  const e = email.toLowerCase();
  if (ADMIN_EMAILS.includes(e)) return 'admin';
  if (!settings) return 'customer';
  if (settings.extraAdminEmails.includes(e)) return 'admin';
  if (settings.shopManagerEmails?.includes(e)) return 'shop-manager';
  const computer = settings.computerStaffEmails.includes(e);
  const solar = settings.solarStaffEmails.includes(e);
  if (computer && solar) return 'full-staff';
  if (computer) return 'computer-staff';
  if (solar) return 'solar-staff';
  if (settings.installerEmails?.includes(e)) return 'installer';
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
    shopManagerEmails: without(s.shopManagerEmails ?? []),
    installerEmails: without(s.installerEmails ?? []),
  };
  if (role === 'admin') next.extraAdminEmails = [...next.extraAdminEmails, e];
  if (role === 'computer-staff' || role === 'full-staff')
    next.computerStaffEmails = [...next.computerStaffEmails, e];
  if (role === 'solar-staff' || role === 'full-staff')
    next.solarStaffEmails = [...next.solarStaffEmails, e];
  if (role === 'shop-manager') next.shopManagerEmails = [...next.shopManagerEmails, e];
  if (role === 'installer') next.installerEmails = [...next.installerEmails, e];
  return next;
}

export default function AdminUsers() {
  const { user, setViewAsEmail } = useAuth();
  const navigate = useNavigate();
  const me = user?.email?.toLowerCase() ?? '';
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

  // Split the long list into the people who work here and everyone else.
  const [audience, setAudience] = useState<'all' | 'team' | 'customers'>('all');
  const [query, setQuery] = useState('');

  // Renaming: one row at a time holds an open name box.
  const [editingUid, setEditingUid] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [savingName, setSavingName] = useState(false);

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

  async function handleSaveName(u: AppUser) {
    const clean = nameDraft.trim();
    setError('');
    setSavingName(true);
    try {
      await setUserName(u.uid, clean);
      // The staff name book is what chats, jobs and the directory read —
      // keep it saying the same thing as the user record.
      if (settings) {
        const book = { ...(settings.staffNames ?? {}) };
        const e = u.email.toLowerCase();
        if (clean) book[e] = clean;
        else delete book[e];
        await updateSettingsField('staffNames', book);
        setSettings({ ...settings, staffNames: book });
      }
      setEditingUid(null);
      setRefresh((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rename failed.');
    } finally {
      setSavingName(false);
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

  // One filtered list, shown as cards on a phone and as the table above it.
  const shownUsers = (users ?? []).filter((u) => {
    if (audience !== 'all') {
      const customer = effectiveRole(u.email, settings) === 'customer';
      if (audience === 'customers' ? !customer : customer) return false;
    }
    const q = query.trim().toLowerCase();
    if (!q) return true;
    // Name, email and the role's own words — "installer" finds the crew.
    return [u.displayName ?? '', u.email, effectiveRole(u.email, settings), ROLE_LABELS[effectiveRole(u.email, settings)]]
      .some((v) => String(v).toLowerCase().includes(q));
  });

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

      {users !== null && users.length > 0 && (
        <div className="relative">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email or role"
            className="input w-full ps-8 sm:max-w-sm"
          />
          <span className="pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
        </div>
      )}

      {users !== null && users.length > 0 && (
        <div className="scrollbar-none -mx-1 flex gap-0.5 overflow-x-auto px-1 text-sm font-semibold sm:mx-0 sm:w-fit sm:self-start sm:rounded-lg sm:border sm:border-slate-200 sm:bg-white sm:p-0.5 sm:px-0.5">
          {(
            [
              { key: 'all', label: `All (${users.length})` },
              {
                key: 'team',
                label: `Team & access (${users.filter((u) => effectiveRole(u.email, settings) !== 'customer').length})`,
              },
              {
                key: 'customers',
                label: `Customers (${users.filter((u) => effectiveRole(u.email, settings) === 'customer').length})`,
              },
            ] as { key: typeof audience; label: string }[]
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setAudience(tab.key)}
              className={`flex-none whitespace-nowrap rounded-lg border px-3 py-1.5 transition sm:rounded-md sm:border-0 ${
                audience === tab.key
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {query.trim() && (
        <p className="-mt-3 text-xs text-slate-500">
          {shownUsers.length} of {users?.length ?? 0} people match “{query.trim()}”
          {shownUsers.length === 0 && (
            <button type="button" onClick={() => setQuery('')} className="ms-2 font-semibold text-brand-700 hover:underline">
              Clear
            </button>
          )}
        </p>
      )}

      {users === null ? (
        <p className="text-center text-sm text-slate-500">Loading…</p>
      ) : users.length === 0 ? (
        <p className="card p-10 text-center text-sm text-slate-500">
          No user records yet. Users will appear here after their first sign-in.
        </p>
      ) : (
        <>
        {/* Phones: one card per person. The table below needs 640px, which
            is wider than the screen — it used to be a sideways scroll. */}
        <ul className="space-y-3 sm:hidden">
          {shownUsers.map((u) => {
            const role = effectiveRole(u.email, settings);
            return (
              <li key={u.uid} className="card p-4">
                <div className="flex items-start gap-3">
                  {u.photoURL ? (
                    <img src={u.photoURL} alt="" className="h-10 w-10 flex-none rounded-full" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">
                      {(u.displayName || u.email).charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-slate-900">
                      {u.displayName || u.email}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingUid(u.uid);
                          setNameDraft(u.displayName ?? '');
                        }}
                        title="Rename"
                        className="ms-1.5 text-slate-400"
                      >
                        ✏️
                      </button>
                    </p>
                    <p dir="ltr" className="truncate text-xs text-slate-500">{u.email}</p>
                  </div>
                  <span
                    className={`flex-none rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      u.disabled ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                    }`}
                  >
                    {u.disabled ? 'Disabled' : 'Active'}
                  </span>
                </div>

                {editingUid === u.uid && (
                  <form
                    className="mt-2 flex items-center gap-1.5"
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSaveName(u);
                    }}
                  >
                    <input
                      autoFocus
                      type="text"
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      placeholder={u.email}
                      className="input flex-1 px-2 py-1 text-sm"
                    />
                    <button type="submit" disabled={savingName} className="btn-primary px-2.5 py-1 text-xs">
                      {savingName ? '…' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingUid(null)}
                      className="text-xs font-semibold text-slate-500"
                    >
                      Cancel
                    </button>
                  </form>
                )}

                <label className="mt-3 block">
                  <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Role</span>
                  <select
                    value={pendingRoles[u.uid] ?? role}
                    onChange={(e) => stageRole(u, e.target.value as AppUser['role'])}
                    className="input w-full"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                </label>
                {pendingRoles[u.uid] && (
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleSaveRole(u)}
                      disabled={savingUid === u.uid}
                      className="btn-primary flex-1 py-1.5 text-xs"
                    >
                      {savingUid === u.uid ? 'Saving…' : 'Save role'}
                    </button>
                    <button
                      type="button"
                      onClick={() => cancelRole(u.uid)}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {role === 'installer' && (
                  <CrewEditor
                    leader={u.email.toLowerCase()}
                    settings={settings}
                    nameOf={(e) => users?.find((x) => x.email.toLowerCase() === e)?.displayName || e}
                    onSaved={(next) => setSettings(next)}
                  />
                )}
                <ExtraPermissions email={u.email.toLowerCase()} settings={settings} onSaved={(next) => setSettings(next)} />

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 pt-3 text-xs">
                  <span className="text-slate-400">
                    Last seen {new Date(u.lastSeenAt).toLocaleDateString('en-GB')}
                  </span>
                  {u.email.toLowerCase() !== me && (
                    <button
                      type="button"
                      onClick={() => {
                        setViewAsEmail(u.email);
                        navigate('/admin');
                      }}
                      className="ms-auto font-semibold text-slate-700"
                    >
                      👁 View as
                    </button>
                  )}
                  <button type="button" onClick={() => handleToggleDisabled(u)} className="font-semibold text-slate-700">
                    {u.disabled ? 'Enable' : 'Disable'}
                  </button>
                  <button type="button" onClick={() => handleDelete(u.uid)} className="font-semibold text-red-700">
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="card hidden overflow-x-auto sm:block">
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
              {shownUsers.map((u) => (
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
                        {editingUid === u.uid ? (
                          <form
                            className="flex items-center gap-1.5"
                            onSubmit={(e) => {
                              e.preventDefault();
                              handleSaveName(u);
                            }}
                          >
                            <input
                              autoFocus
                              type="text"
                              value={nameDraft}
                              onChange={(e) => setNameDraft(e.target.value)}
                              placeholder={u.email}
                              className="input max-w-[180px] px-2 py-1 text-sm"
                            />
                            <button
                              type="submit"
                              disabled={savingName}
                              className="btn-primary px-2.5 py-1 text-xs"
                            >
                              {savingName ? '…' : 'Save'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingUid(null)}
                              disabled={savingName}
                              className="text-xs font-semibold text-slate-500 hover:underline"
                            >
                              Cancel
                            </button>
                          </form>
                        ) : (
                          <p className="truncate font-semibold text-slate-900">
                            {u.displayName || u.email}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingUid(u.uid);
                                setNameDraft(u.displayName ?? '');
                              }}
                              title="Rename"
                              className="ms-1.5 text-slate-400 hover:text-brand-600"
                            >
                              ✏️
                            </button>
                          </p>
                        )}
                        <p className="text-xs text-slate-500">{u.email}</p>
                      </div>
                      {/* See the dashboard as this person sees it. */}
                      {u.email.toLowerCase() !== me && (
                        <button
                          type="button"
                          onClick={() => {
                            setViewAsEmail(u.email);
                            navigate('/admin');
                          }}
                          title={`See the dashboard as ${u.displayName || u.email}`}
                          className="ms-auto flex-none rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          👁 View as
                        </button>
                      )}
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
                    {effectiveRole(u.email, settings) === 'installer' && (
                      <CrewEditor
                        leader={u.email.toLowerCase()}
                        settings={settings}
                        nameOf={(e) =>
                          users?.find((x) => x.email.toLowerCase() === e)?.displayName || e
                        }
                        onSaved={(next) => setSettings(next)}
                      />
                    )}
                    <ExtraPermissions
                      email={u.email.toLowerCase()}
                      settings={settings}
                      onSaved={(next) => setSettings(next)}
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {new Date(u.lastSeenAt).toLocaleDateString('en-GB')}
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
        </>
      )}
    </div>
  );
}

/**
 * Which installers ride with this one. Ticking anyone makes them a team
 * leader; a leader can put their own crew on a job from the job editor.
 */
function CrewEditor({
  leader,
  settings,
  nameOf,
  onSaved,
}: {
  leader: string;
  settings: SiteSettings | null;
  nameOf: (email: string) => string;
  onSaved: (next: SiteSettings) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busyEmail, setBusyEmail] = useState('');
  const others = (settings?.installerEmails ?? []).filter((e) => e !== leader);
  const leaders = settings?.installerLeaders ?? {};
  const crew = leaders[leader] ?? [];
  if (!settings || others.length === 0) return null;

  async function toggle(member: string) {
    const next = crew.includes(member) ? crew.filter((e) => e !== member) : [...crew, member];
    const map = { ...leaders };
    if (next.length) map[leader] = next;
    else delete map[leader];
    setBusyEmail(member);
    try {
      await updateSettingsField('installerLeaders', map);
      onSaved({ ...settings!, installerLeaders: map });
    } finally {
      setBusyEmail('');
    }
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${
          crew.length
            ? 'bg-amber-50 text-amber-800 ring-amber-200'
            : 'bg-slate-50 text-slate-500 ring-slate-200'
        }`}
      >
        {crew.length ? `\u{1F477} Team leader \u00B7 ${crew.length} crew` : '\u{1F477} Make team leader\u2026'}
      </button>
      {open && (
        <div className="mt-2 max-w-xs space-y-0.5 rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
          <p className="px-1 pb-1 text-[11px] text-slate-500">
            Installers under {nameOf(leader)} — the leader can put them on his own jobs from the job
            editor.
          </p>
          {others.map((e) => (
            <label
              key={e}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-slate-50"
            >
              <input
                type="checkbox"
                checked={crew.includes(e)}
                disabled={busyEmail === e}
                onChange={() => toggle(e)}
                className="h-4 w-4 rounded border-slate-300 text-brand-600"
              />
              <span className="truncate">{nameOf(e)}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Every door this person may open, as one list of switches: the ones
 * their role carries are already ticked, and any of them can be given or
 * taken away by name — the customer messages handed to an installer, or
 * closed for a staffer whose role would otherwise include them.
 */
function ExtraPermissions({
  email,
  settings,
  onSaved,
}: {
  email: string;
  settings: SiteSettings | null;
  onSaved: (next: SiteSettings) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busyKey, setBusyKey] = useState('');
  if (!settings) return null;
  const isAdmin = ADMIN_EMAILS.includes(email) || settings.extraAdminEmails.includes(email);
  if (isAdmin) return null;

  const roles = {
    isAdmin: false,
    isComputerStaff: settings.computerStaffEmails.includes(email),
    isSolarStaff: settings.solarStaffEmails.includes(email),
    isShopManager: (settings.shopManagerEmails ?? []).includes(email),
    isInstaller: (settings.installerEmails ?? []).includes(email),
    isCrmSolar: (settings.crmSolarEmails ?? []).includes(email),
    isCrmComputers: (settings.crmComputerEmails ?? []).includes(email),
  };
  const extras = extrasFor(settings.permissions, email);
  const denied = extrasFor(settings.permissionsOff, email);
  const fromRole = permissionsFor(roles, []);
  const granted = permissionsFor(roles, extras, denied);

  /**
   * One switch per door. Turning something on that the role does not
   * carry adds it; turning something off that the role does carry writes
   * it to the taken-away list, so a role can be trimmed without being
   * changed.
   */
  async function toggle(key: string) {
    const on = granted.has(key as typeof key & never) || granted.has(key as never);
    const perms = { ...(settings!.permissions ?? {}) };
    const off = { ...(settings!.permissionsOff ?? {}) };
    const setList = (map: Record<string, string[]>, list: string[]) => {
      if (list.length) map[email] = list;
      else delete map[email];
    };
    if (on) {
      // Take it away: drop any extra grant, and record the denial when
      // the role would otherwise hand it back.
      setList(perms, extrasFor(perms, email).filter((k) => k !== key));
      if (fromRole.has(key as never)) setList(off, [...new Set([...extrasFor(off, email), key])]);
    } else {
      setList(off, extrasFor(off, email).filter((k) => k !== key));
      if (!fromRole.has(key as never)) setList(perms, [...new Set([...extrasFor(perms, email), key])]);
    }
    setBusyKey(key);
    try {
      await updateSettingsField('permissions', perms);
      await updateSettingsField('permissionsOff', off);
      onSaved({ ...settings!, permissions: perms, permissionsOff: off });
    } finally {
      setBusyKey('');
    }
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200"
      >
        🔑 Permissions · {granted.size}/{PERMISSIONS.length} {open ? '▲' : '▼'}
      </button>
      {open && (
        <div className="mt-2 grid gap-1 rounded-xl border border-slate-200 bg-slate-50 p-2 sm:grid-cols-2">
          {PERMISSIONS.map((p) => {
            const byRole = fromRole.has(p.key);
            const on = granted.has(p.key);
            const where = !on && byRole ? 'taken away' : on && byRole ? 'from their role' : on ? 'given to them' : p.hint;
            return (
              <label
                key={p.key}
                title={p.hint}
                className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-white"
              >
                <input
                  type="checkbox"
                  checked={on}
                  disabled={busyKey === p.key}
                  onChange={() => toggle(p.key)}
                  className="mt-0.5 h-4 w-4 flex-none accent-brand-600"
                />
                <span className="min-w-0">
                  <span className="block font-semibold text-slate-800">{p.label}</span>
                  <span className={`block text-[11px] ${!on && byRole ? 'text-red-600' : 'text-slate-500'}`}>
                    {where}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
