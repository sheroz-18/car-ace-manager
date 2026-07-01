import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  hint,
  hintTone = "neutral",
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  hintTone?: "neutral" | "success" | "warning" | "danger";
  icon?: LucideIcon;
}) {
  const toneClass = {
    neutral: "text-muted-foreground",
    success: "text-success",
    warning: "text-warning",
    danger: "text-destructive",
  }[hintTone];

  return (
    <div className="bg-card p-6 rounded-2xl border border-border shadow-card animate-slide-up">
      <div className="flex items-start justify-between mb-3">
        <div className="text-sm text-muted-foreground">{label}</div>
        {Icon && (
          <div className="size-9 bg-secondary rounded-lg flex items-center justify-center text-muted-foreground">
            <Icon className="size-4" />
          </div>
        )}
      </div>
      <div className="text-2xl font-bold tracking-tight text-foreground">{value}</div>
      {hint && <div className={`mt-2 text-xs font-medium ${toneClass}`}>{hint}</div>}
    </div>
  );
}
