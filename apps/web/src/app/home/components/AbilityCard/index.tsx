"use client";

import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { createTiltCardHandlers } from "@/utils/tiltCard";
import { AbilityArtwork, type AbilityArtworkKind } from "../AbilityArtwork";
import styles from "../../page.module.scss";

type AbilityCardProps = {
  title: string;
  desc: string;
  number: string;
  artwork: AbilityArtworkKind;
  icon: LucideIcon;
  onClick: () => void;
};

const tiltHandlers = createTiltCardHandlers<HTMLButtonElement>();

/**
 * 渲染首页单张能力入口卡片。
 *
 * @param props - 组件属性。
 * @returns 带倾斜交互的能力卡片。
 */
export function AbilityCard({ title, desc, number, artwork, icon: Icon, onClick }: AbilityCardProps) {
  return (
    <button
      className={styles.ability}
      data-artwork={artwork}
      onClick={onClick}
      {...tiltHandlers}
    >
      <div className={styles.abilityVisual}>
        <AbilityArtwork kind={artwork} />
      </div>
      <div className={styles.abilityTop}>
        <span>{number}</span>
        <Icon size={18} strokeWidth={1.35} />
      </div>
      <div className={styles.abilityInfo}>
        <div>
          <h3>{title}</h3>
          <p>{desc}</p>
        </div>
        <ArrowRight size={15} />
      </div>
    </button>
  );
}
