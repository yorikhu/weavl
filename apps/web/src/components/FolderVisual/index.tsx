import styles from "./index.module.scss";

interface FolderVisualProps {
  size?: "small" | "medium";
  open?: boolean;
  className?: string;
}

/**
 * 通用文件夹图形；用于资产目录、节点分组等需要表达容器关系的场景。
 *
 * @param props - 文件夹尺寸、开合状态和样式类。
 * @returns 可复用的文件夹 SVG。
 */
export function FolderVisual({ size = "small", open = false, className }: FolderVisualProps) {
  return (
    <svg
      className={`${styles.folder} ${size === "medium" ? styles.medium : styles.small} ${className ?? ""}`}
      viewBox="0 0 48 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {open ? (
        <>
          <path
            className={styles.back}
            d="M3.75 9.25A4.25 4.25 0 0 1 8 5h9.25c1.13 0 2.21.45 3.01 1.25l2.49 2.5c.47.47 1.1.73 1.77.73H40a4.25 4.25 0 0 1 4.25 4.22v17.05A4.25 4.25 0 0 1 40 35H8a4.25 4.25 0 0 1-4.25-4.25V9.25Z"
          />
          <path
            className={styles.front}
            d="M4.55 15.7a4.7 4.7 0 0 1 4.62-3.92h32.66a4.7 4.7 0 0 1 4.62 5.55l-2.5 14.05A4.4 4.4 0 0 1 39.62 35H8.72a4.4 4.4 0 0 1-4.33-5.18L4.55 15.7Z"
          />
          <path className={styles.highlight} d="M9.12 12.95h32.7c1.35 0 2.55.58 3.36 1.52" />
        </>
      ) : (
        <>
          <path
            className={styles.closed}
            d="M3.75 9.25A4.25 4.25 0 0 1 8 5h9.25c1.13 0 2.21.45 3.01 1.25l2.49 2.5c.47.47 1.1.73 1.77.73H40A4.25 4.25 0 0 1 44.25 13.7v17.05A4.25 4.25 0 0 1 40 35H8a4.25 4.25 0 0 1-4.25-4.25V9.25Z"
          />
          <path className={styles.closedHighlight} d="M4.2 13h39.6" />
        </>
      )}
    </svg>
  );
}
