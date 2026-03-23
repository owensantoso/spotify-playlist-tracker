type StatCardProps = {
  label: string;
  value: string | number;
  hint?: string;
};

export function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <div className="min-h-[7.5rem] rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] leading-4 text-stone-400">
        {label}
      </p>
      <p className="mt-3 text-[clamp(1.9rem,2.2vw,2.5rem)] font-semibold tracking-tight text-stone-100">
        {value}
      </p>
      {hint ? <p className="mt-2 text-xs leading-5 text-stone-400">{hint}</p> : null}
    </div>
  );
}
