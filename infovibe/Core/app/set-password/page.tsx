"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState, Suspense } from "react";

export default function SetPasswordPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SetPasswordForm />
    </Suspense>
  );
}

function SetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId") || "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ password, mustChangePassword: false })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to set password.");
      }

      router.push("/dashboard");
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to set password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="panel mx-auto flex w-full max-w-md flex-col gap-5 p-8" onSubmit={handleSubmit}>
      <div>
        <h2 className="mt-2 font-display text-3xl font-bold text-ink dark:text-white">Set Your Permanent Password</h2>
      </div>
      <label className="space-y-2">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">New Password</span>
        <input
          className="input"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Enter new password"
          required
          type="password"
          value={password}
        />
      </label>
      {error ? <p className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger dark:bg-danger/20 dark:text-red-300">{error}</p> : null}
      <button className="button-primary" disabled={submitting} type="submit">
        {submitting ? "Setting..." : "Set Password"}
      </button>
    </form>
  );
}
