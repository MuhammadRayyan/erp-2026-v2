"use client";

import { useMemo, useState } from "react";
import { businessRoles } from "@/modules/access/roles";

export function InvitationForm({
  tenantId,
  businesses,
}: {
  tenantId: string;
  businesses: Array<{ id: string; legalName: string }>;
}) {
  const [email, setEmail] = useState("");
  const [businessId, setBusinessId] = useState(businesses[0]?.id ?? "");
  const [roleKey, setRoleKey] = useState("business.viewer");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const canSubmit = useMemo(() => email.trim().length > 3 && Boolean(businessId), [email, businessId]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    setPending(true);
    setMessage(null);
    setInviteUrl(null);

    const response = await fetch(`/api/tenants/${tenantId}/invitations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        expiresInDays: 7,
        businessGrants: [{ businessId, roleKey }],
      }),
    });
    const result = await response.json();

    if (!response.ok) {
      setMessage(result.message ?? "The invitation could not be created.");
      setPending(false);
      return;
    }

    const url = `${window.location.origin}/invitations/${result.invitationToken}`;
    setInviteUrl(url);
    setMessage("Invitation created. Share this link securely with the invited user.");
    setEmail("");
    setPending(false);
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      <div>
        <p className="text-sm font-medium text-[var(--brand)]">Invite user</p>
        <h2 className="mt-1 text-xl font-semibold">Grant business access</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">The invitation is valid for seven days and is restricted to the invited email address.</p>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <label className="grid gap-2 text-sm font-medium">
          Email
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required className="rounded-xl border border-[var(--border)] bg-transparent px-3 py-2.5 outline-none focus:border-[var(--brand)]" placeholder="user@example.com" />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Business
          <select value={businessId} onChange={(event) => setBusinessId(event.target.value)} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 outline-none focus:border-[var(--brand)]">
            {businesses.map((business) => <option key={business.id} value={business.id}>{business.legalName}</option>)}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Role
          <select value={roleKey} onChange={(event) => setRoleKey(event.target.value)} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 outline-none focus:border-[var(--brand)]">
            {businessRoles.filter((role) => role.key !== "business.owner").map((role) => <option key={role.key} value={role.key}>{role.label}</option>)}
          </select>
        </label>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button disabled={!canSubmit || pending} className="rounded-xl bg-[var(--brand)] px-4 py-2.5 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">{pending ? "Creating…" : "Create invitation"}</button>
        {message && <p className="text-sm text-[var(--muted)]">{message}</p>}
      </div>
      {inviteUrl && <div className="mt-4 rounded-xl bg-[var(--surface-muted)] p-3 text-sm break-all"><span className="font-medium">Invitation link:</span> {inviteUrl}</div>}
    </form>
  );
}
