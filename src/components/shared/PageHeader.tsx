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
    <div className={cn("flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between orbit-page-head", className)}>
      <div className="min-w-0 flex-1">
        {eyebrow && <p className="orbit-kicker">{eyebrow}</p>}
        <h1 className="text-[clamp(1.5rem,2.6vw,2rem)] font-extrabold tracking-tight text-[#111827]">
          {title}
        </h1>
        {description && (
          <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-[#5B6472]">
            {description}
          </p>
        )}
      </div>
      {children && <div className="flex flex-shrink-0 items-center gap-3 pt-3 sm:pt-0">{children}</div>}
    </div>
  );
}

export function PageHeaderAdmin(props: PageHeaderProps) {
  return <PageHeader {...props} />;
}
