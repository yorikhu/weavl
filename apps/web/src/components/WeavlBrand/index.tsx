import Link from "next/link";
import { StarburstLogo } from "@/components/StarburstLogo";
import styles from "./index.module.scss";

type WeavlBrandProps = {
  className?: string;
  iconSize?: number;
};

export function WeavlBrand({ className, iconSize = 22 }: WeavlBrandProps) {
  return (
    <Link href="/home" className={[styles.brand, className].filter(Boolean).join(" ")} aria-label="Weavl，返回首页">
      <StarburstLogo size={iconSize} />
      <span className={styles.text}>
        <span className={styles.name}>Weavl</span>
        <span className={styles.subtitle}>织光拾忆</span>
      </span>
    </Link>
  );
}
