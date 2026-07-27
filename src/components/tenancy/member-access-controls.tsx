"use client";

import { useState } from "react";
import { businessRoles } from "@/modules/access/roles";

type Grant = {
  businessId: string;
  businessName: string;
  roleKey: string;
  status: string;
};

export function MemberAccessControls({
  tenantId,
  userId,
  isOwner,
  memberStatus,
  grants,
}: {
  tenantId: string;
  userId: string;
  isOwner: boolean;
  memberStatus: string;
  grants: Grant[];
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function update(payload: object) {
    setPending(true);
    setMessage(null);
    const response = await fetch(`/api/tenants/${tenantId}/members/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    setPending(false);

    if (!response.ok) {
      setMessage(result.code === "TENANT_OWNER_PROTECTED"
        ? "Tenant owners cannot be disabled here."
        : result.message ?? "Access could not be updated.");
      return;
    }

    window.location.reload();
  }

  return (
    <div className="mt-4 space-y-3 border-t border-[var(--border)] pt-4">
      {grants.map((grant) => (
        <div key={grant.businessId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--surface-muted)] px-3 py-2">
          <div>
            <p className="text-sm font-medium">{grant.businessName}</p>
            <p className="text-xs text-[var(--muted)]">{grant.status.toLowerCase()}</p>
          </div>
          <select
            defaultValue={grant.roleKey}
            disabled={pending || isOwner}
            onChange={(event) => update({ businessGrants: [{ businessId: grant.businessId, roleKey: event.target.value, status: "ACTIVE" }] })}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm disabled:opacity-60"
            aria-label={`Role for ${grant.businessName}`}
          >
            {businessRoles.filter((role) => role.key !== "business.owner").map((role) => (
              <option key={role.key} value={role.key}>{role.label}</option>
            ))}
          </select>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pending || isOwner}
          onClick={() => update({ status: memberStatus === "ACTIVE" ? "DISABLED" : "ACTIVE" })}
          className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium transition hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Updating…" : memberStatus === "ACTIVE" ? "Disable access" : "Reactivate access"}
        </button>
        {isOwner && <span className="text-xs text-[var(--muted)]">Owner access is protected.</span>}
        {message && <span role="status" className="text-sm text-[var(--danger)]">{message}</span>}
      </div>
    </div>
  );
}
