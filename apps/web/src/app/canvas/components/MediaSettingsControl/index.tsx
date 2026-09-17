"use client";

import { ChevronDown } from "lucide-react";
import { Popover } from "@/components/Popover";
import { getMediaCardSize, type MediaDimensionOption } from "../../utils/mediaSizing";
import styles from "./index.module.scss";

interface MediaSettingsControlProps {
  open: boolean;
  ratio: string;
  dimensions: MediaDimensionOption[];
  quality: string;
  qualities: string[];
  qualityLabel?: string;
  resolution?: string;
  resolutions?: string[];
  duration?: number;
  durations?: number[];
  count: number;
  counts: number[];
  countUnit: "张" | "个";
  onOpenChange: (open: boolean) => void;
  onDimensionChange: (value: MediaDimensionOption) => void;
  onQualityChange: (value: string) => void;
  onResolutionChange?: (value: string) => void;
  onDurationChange?: (value: number) => void;
  onCountChange: (value: number) => void;
}

/**
 * 按真实宽高比绘制规格选项中的比例示意图。
 *
 * @param props - 输出尺寸及是否使用紧凑展示。
 * @returns 不超过组件边界的比例标记。
 */
function RatioMark({ option, compact = false }: { option: MediaDimensionOption; compact?: boolean }) {
  const cardSize = getMediaCardSize(option);
  const scale = (compact ? 14 : 20) / 300;

  return (
    <span
      className={`${styles.ratioMark} ${compact ? styles.ratioMarkCompact : ""}`}
      style={{
        width: Math.max(compact ? 5 : 7, cardSize.w * scale),
        height: Math.max(compact ? 5 : 7, cardSize.h * scale),
      }}
    />
  );
}

/**
 * 渲染媒体设置中可复用的单选按钮组。
 *
 * @param props - 分组标题、候选项、当前值和变更回调。
 * @returns 带选中状态的参数按钮组。
 */
function ChoiceGroup({
  label,
  values,
  value,
  columns = 3,
  format = (item) => item,
  onChange,
}: {
  label: string;
  values: string[];
  value: string;
  columns?: number;
  format?: (item: string) => string;
  onChange: (value: string) => void;
}) {
  return (
    <section className={styles.section}>
      <h4>{label}</h4>
      <div className={styles.choiceGrid} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {values.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={item === value}
            className={`${styles.choice} ${item === value ? styles.active : ""}`}
            onClick={() => onChange(item)}
          >
            {format(item)}
          </button>
        ))}
      </div>
    </section>
  );
}

/**
 * 渲染图片与视频节点共用的生成尺寸、清晰度和数量设置。
 *
 * @param props - 媒体类型、当前模型、选中参数和状态更新回调。
 * @returns 可展开的媒体参数选择器。
 */
export function MediaSettingsControl({
  open,
  ratio,
  dimensions,
  quality,
  qualities,
  qualityLabel = "画质",
  resolution,
  resolutions,
  duration,
  durations,
  count,
  counts,
  countUnit,
  onOpenChange,
  onDimensionChange,
  onQualityChange,
  onResolutionChange,
  onDurationChange,
  onCountChange,
}: MediaSettingsControlProps) {
  const selectedDimension = dimensions.find((item) => item.ratio === ratio) ?? dimensions[0];
  const summary = [
    ratio,
    quality,
    resolution,
    duration === undefined ? undefined : `${duration}s`,
    `${count}${countUnit}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className={styles.wrap}>
      <Popover
        mode="click"
        open={open}
        onOpenChange={onOpenChange}
        side="top"
        align="start"
        sideOffset={10}
        collisionPadding={16}
        showArrow={false}
        autoFocusOnOpen={false}
        contentScope="node-prompt"
        contentClassName={styles.panel}
        trigger={
          <button type="button" className={styles.trigger}>
            {selectedDimension && <RatioMark option={selectedDimension} compact />}
            <span>{summary}</span>
            <ChevronDown size={10} className={open ? styles.chevronOpen : undefined} />
          </button>
        }
      >
        <div className={styles.panelBody}>
          <ChoiceGroup label={qualityLabel} values={qualities} value={quality} onChange={onQualityChange} />
          {resolution && resolutions && onResolutionChange && (
            <ChoiceGroup label="清晰度" values={resolutions} value={resolution} onChange={onResolutionChange} />
          )}
          <section className={styles.section}>
            <h4>比例</h4>
            <div className={styles.ratioGrid}>
              {dimensions.map((item) => (
                <button
                  key={`${item.ratio}-${item.width}x${item.height}`}
                  type="button"
                  aria-pressed={item.ratio === ratio}
                  className={`${styles.ratioChoice} ${item.ratio === ratio ? styles.active : ""}`}
                  onClick={() => onDimensionChange(item)}
                >
                  <RatioMark option={item} />
                  <span>{item.ratio}</span>
                </button>
              ))}
            </div>
          </section>
          {duration !== undefined && durations && onDurationChange && (
            <ChoiceGroup
              label="视频时长"
              values={durations.map(String)}
              value={String(duration)}
              format={(item) => `${item}秒`}
              onChange={(item) => onDurationChange(Number(item))}
            />
          )}
          <ChoiceGroup
            label="生成数量"
            values={counts.map(String)}
            value={String(count)}
            format={(item) => `${item}${countUnit}`}
            onChange={(item) => onCountChange(Number(item))}
          />
        </div>
      </Popover>
    </div>
  );
}
