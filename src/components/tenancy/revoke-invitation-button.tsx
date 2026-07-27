"use client";

import { useState } from "react";

export function RevokeInvitationButton({
  tenantId,
  invitationId,
}: {
  tenantId: string;
  invitationId: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function revoke() {
    setPending(true);
    setError(null);
    const response = await fetch(`/api/tenants/${tenantId}/invitations/${invitationId}`, {
      method: "DELETE",
    });
    setPending(false);

    if (!response.ok) {
      setError("The invitation could not be revoked.");
      return;
    }

    window.location.reload();
  }

  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={revoke} disabled={pending} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium transition hover:bg-[var(--surface-muted)] disabled:opacity-50">
        {pending ? "Revoking…" : "Revoke"}
      </button>
      {error && <span role="alert" className="text-xs text-[var(--danger)]">{error}</span>}
    </div>
  );
}
