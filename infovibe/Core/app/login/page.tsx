import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getHomeRoute } from "@/lib/roles";
import LoginForm from "@/components/LoginForm";

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getErrorMessage(error: string | string[] | undefined) {
  const value = Array.isArray(error) ? error[0] : error;
  if (value === "missing_credentials") return "Email and password are required.";
  if (value === "invalid_credentials") return "Invalid email or password.";
  if (value === "login_failed") return "Unable to sign in right now.";
  return null;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getCurrentUser();
  if (user) redirect(getHomeRoute(user.role));

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const errorMessage = getErrorMessage(resolvedSearchParams.error);

  return (
    <div className="flex min-h-screen items-center justify-center overflow-hidden relative p-4 lg:p-8 bg-[#0B1120] text-white">
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-blue-600/20 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-600/20 blur-[130px] pointer-events-none" />

      <section className="reveal glass-card flex w-full flex-col justify-between gap-4 p-8 lg:min-h-[500px] lg:p-12 z-10 mx-4 lg:mx-0 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-blue-500/80 dark:text-blue-400">by InfoVibeX</p>
          <h1 className="brand-display mt-4 max-w-xl text-5xl font-bold tracking-tight text-ink dark:text-white lg:text-6xl">
            <span className="premium-gradient-text">TaskManager</span>
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-300">
            TaskManager — Manage staff, tasks, chat, and secure meetings from a single enterprise platform.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-700 bg-slate-800/80 p-5 transition hover:border-blue-500/50 backdrop-blur-md">
            <p className="text-base font-bold text-white glass-text">Secure access</p>
            <p className="mt-2 text-sm text-slate-400 font-medium tracking-wide">JWT auth, cookie-based sessions.</p>
          </div>
          <div className="rounded-2xl border border-slate-700 bg-slate-800/80 p-5 transition hover:border-blue-500/50 backdrop-blur-md">
            <p className="text-base font-bold text-white glass-text">Instant meetings</p>
            <p className="mt-2 text-sm text-slate-400 font-medium tracking-wide">One click secure video meeting room.</p>
          </div>
          <div className="rounded-2xl border border-slate-700 bg-slate-800/80 p-5 transition hover:border-blue-500/50 backdrop-blur-md">
            <p className="text-base font-bold text-white glass-text">Role controls</p>
            <p className="mt-2 text-sm text-slate-400 font-medium tracking-wide">Separated admin/employee experiences.</p>
          </div>
        </div>
      </section>
      <div className="z-10 mx-4 lg:mx-0" style={{ animationDelay: "0.2s" }}>
        <LoginForm />
      </div>
    </div>
  );
}
