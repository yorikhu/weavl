import Link from "next/link";
import styles from "./index.module.scss";

/** Weavl 品牌组件属性；full 展示中英文品牌，icon 只展示图形标识。 */
export type WeavlBrandProps = {
  className?: string;
  iconSize?: number;
  variant?: "full" | "icon";
};

function BrandIcon({ size }: { size: number }) {
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

/**
 * 全局 Weavl 品牌入口，统一首页、登录页、侧栏及画布中的品牌图形。
 *
 * @param props - 品牌形态、图标尺寸和样式类。
 * @returns Weavl 品牌标识。
 */
export function WeavlBrand({ className, iconSize = 22, variant = "full" }: WeavlBrandProps) {
  if (variant === "icon") {
    return (
      <span className={[styles.icon, className].filter(Boolean).join(" ")}>
        <BrandIcon size={iconSize} />
      </span>
    );
  }

  return (
    <Link href="/home" className={[styles.brand, className].filter(Boolean).join(" ")} aria-label="Weavl，返回首页">
      <BrandIcon size={iconSize} />
      <span className={styles.text}>
        <span className={styles.name}>Weavl</span>
        <span className={styles.subtitle}>织光拾忆</span>
      </span>
    </Link>
  );
}
