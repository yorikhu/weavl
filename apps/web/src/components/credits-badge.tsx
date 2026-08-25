import { Coins } from "lucide-react";

/**
 * 积分徽章 —— 原型中的"流光"已更名为"积分"。
 * 图标：lucide Coins（两枚硬币叠合），配低饱和琥珀光晕。
 */
export function CreditsBadge({
  amount,
  onClick,
}: {
  amount: number;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title="积分余额"
      className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium transition-all hover:border-border-strong accent-glow"
    >
      <Coins className="h-3.5 w-3.5 text-[var(--accent)]" />
      <span className="text-muted-foreground">积分</span>
      <span className="font-semibold tabular-nums">{amount.toLocaleString()}</span>
    </button>
  );
}
