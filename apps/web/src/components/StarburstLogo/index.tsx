import styles from "./index.module.scss";

/**
 * Weavl 织光 · 星芒徽标（厚实圆润版）
 * 四瓣星光 —— 填充 + 同色圆角描边撑厚，无动画。
 */
export function StarburstLogo({ size = 22 }: { size?: number }) {
  return (
    <svg
      className={styles.logo}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M12 2.8C12.9 7.6 16.4 11.1 21.2 12C16.4 12.9 12.9 16.4 12 21.2C11.1 16.4 7.6 12.9 2.8 12C7.6 11.1 11.1 7.6 12 2.8Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
