type DashboardStat = {
  label: string;
  value: number;
  accent: string;
};

type DashboardStatsProps = {
  stats: DashboardStat[];
};

export default function DashboardStats({ stats }: DashboardStatsProps) {
  return (
    <section aria-labelledby="dashboard-stats-title">
      <h2 className="sr-only" id="dashboard-stats-title">
        Dashboard summary
      </h2>
      <dl className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
        {stats.map((stat) => (
          <div className="panel p-3 sm:p-4 transition-all duration-200 hover:-translate-y-1 hover:shadow-md dark:bg-slate-900 dark:text-white" key={stat.label}>
            <dt>
              <span className={`badge ${stat.accent} dark:text-white`}>{stat.label}</span>
            </dt>
            <dd className="mt-3 font-display text-3xl font-bold text-ink dark:text-white sm:text-4xl">{stat.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}