import { cn } from "@/lib/utils/cn";

interface PageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  children?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, eyebrow, children, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between orbit-page-head", className)}>
      <div className="min-w-0 flex-1">
        {eyebrow && <p className="orbit-kicker">{eyebrow}</p>}
        <h1 className="text-[clamp(1.55rem,2.8vw,2.125rem)] font-extrabold tracking-tight text-[var(--text-primary)]">
          {title}
        </h1>
        {description && (
          <p className="mt-3 max-w-3xl text-[14px] leading-relaxed text-[var(--text-secondary)]">{description}</p>
        )}
      </div>
      {children && <div className="flex shrink-0 flex-wrap items-center gap-3 pt-1 sm:pt-0">{children}</div>}
    </div>
  );
}

export function PageHeaderAdmin(props: PageHeaderProps) {
  return <PageHeader {...props} />;
}
