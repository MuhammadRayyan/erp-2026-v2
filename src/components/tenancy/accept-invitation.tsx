"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AcceptInvitation({ token }: { token: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function accept() {
    setPending(true);
    setMessage(null);

    const response = await fetch("/api/invitations/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const result = await response.json();

    if (!response.ok) {
      setMessage(result.message ?? "The invitation could not be accepted.");
      setPending(false);
      return;
    }

    router.push("/businesses");
    router.refresh();
  }

  return (
    <div>
      <button onClick={accept} disabled={pending} className="rounded-xl bg-[var(--brand)] px-4 py-2.5 font-medium text-white disabled:opacity-50">
        {pending ? "Accepting…" : "Accept invitation"}
      </button>
      {message && <p className="mt-3 text-sm text-[var(--danger)]">{message}</p>}
    </div>
  );
}
