import { cn } from "@/lib/utils";

type SectionCardProps = {
  title: string;
  eyebrow?: string;
  className?: string;
  children: React.ReactNode;
};

export function SectionCard({ title, eyebrow, className, children }: SectionCardProps) {
  return (
    <section className={cn("rounded-[1.8rem] border border-white/10 bg-[rgba(255,255,255,0.04)] p-5", className)}>
      {eyebrow ? (
        <p className="font-mono text-xs uppercase tracking-[0.28em] text-[--color-accent]">{eyebrow}</p>
      ) : null}
      <h2 className="mt-2 text-xl font-semibold tracking-tight text-stone-100">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
