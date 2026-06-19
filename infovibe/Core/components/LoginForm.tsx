"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const emailInputId = "login-email";
  const passwordInputId = "login-password";

  async function handleLogin() {
    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to sign in.");
      }

      if (data.user.mustChangePassword) {
        window.location.href = `/set-password?userId=${data.user.id}`;
        return;
      }

      const roleHome: Record<string, string> = {
        employee: "/dashboard/employee",
        team_lead: "/dashboard/team-lead",
        hr: "/dashboard/hr",
        super_admin: "/dashboard/admin",
      };
      const nextPath = roleHome[data.user.role] || "/dashboard/employee";
      window.location.href = nextPath;
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Unable to sign in.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div aria-describedby="login-help" className="reveal glass-card flex flex-col items-center justify-center gap-6 w-full max-w-md mx-auto p-10 rounded-[2.5rem] shadow-2xl duration-700">
      <div className="text-center space-y-2 w-full">
        <div className="inline-flex rounded-full bg-blue-500/10 px-4 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 border border-blue-500/20 mb-2">
          Secure Login
        </div>
        <h2 className="brand-display text-4xl font-bold text-white tracking-tight">
          Access
          <span className="premium-gradient-text">TaskManager</span>
        </h2>
        <p className="text-sm text-slate-400 font-medium" id="login-help">
          Sign in with your company email and password.
        </p>
      </div>

      <div className="w-full space-y-5">
        <label className="block space-y-2" htmlFor={emailInputId}>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Email</span>
          <input
            autoComplete="email"
            className="w-full rounded-xl border border-slate-700 bg-slate-900/50 px-4 py-3.5 text-sm text-white placeholder-slate-500 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            id={emailInputId}
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@infovibex.com"
            required
            type="email"
            value={email}
          />
        </label>

        <label className="block space-y-2" htmlFor={passwordInputId}>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Password</span>
          <input
            autoComplete="current-password"
            className="w-full rounded-xl border border-slate-700 bg-slate-900/50 px-4 py-3.5 text-sm text-white placeholder-slate-500 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            id={passwordInputId}
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            required
            type="password"
            value={password}
          />
        </label>

        {error ? (
          <p className="text-center text-sm text-red-400 font-medium animate-bounce" role="alert">
            {error}
          </p>
        ) : null}

        <button 
          aria-busy={submitting} 
           className="glow relative w-full overflow-hidden rounded-xl bg-blue-600 px-6 py-4 text-sm font-bold text-white shadow-2xl transition hover:bg-blue-500 active:scale-95 disabled:opacity-50 mt-2" 
           disabled={submitting} 
           onClick={handleLogin}
           type="button"
         >
           {submitting ? "Authenticating..." : "Sign in to Dashboard"}
         </button>

        <p className="text-center text-[11px] font-medium text-slate-500 tracking-wide mt-4">
          First system bootstrap: call the register API once to create the initial admin account.
        </p>
      </div>
    </div>
  );
}