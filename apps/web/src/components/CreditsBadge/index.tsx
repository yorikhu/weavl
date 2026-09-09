import { Coins } from "lucide-react";
import styles from "./index.module.scss";

/** 积分徽章（顶栏常驻）—— lucide Coins 双硬币图标 + 琥珀光晕 */
export function CreditsBadge({ amount, onClick }: { amount: number; onClick?: () => void }) {
  return (
    <button onClick={onClick} title="积分余额" className={`${styles.badge} accent-glow`}>
      <Coins size={14} className={styles.icon} />
      <span className={styles.amount}>{amount.toLocaleString()}</span>
    </button>
  );
}
