"use client";

import { useEffect, useMemo, useState } from "react";
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
 * 使用模型时长能力的最小值和最大值渲染逐秒滑杆与数字输入。
 *
 * @param props - 当前时长、模型支持的时长集合与变更回调。
 * @returns 可拖拽且可直接输入的视频时长控件。
 */
function DurationControl({
  value,
  values,
  onChange,
}: {
  value: number;
  values: number[];
  onChange: (value: number) => void;
}) {
  const options = useMemo(() => [...new Set(values)].filter(Number.isFinite).sort((a, b) => a - b), [values]);
  const minimum = options[0] ?? 1;
  const maximum = options.at(-1) ?? minimum;
  const [draft, setDraft] = useState(String(value));
  const parsedDraft = Number(draft);
  const sliderValue = Math.min(maximum, Math.max(minimum, Number.isFinite(parsedDraft) ? parsedDraft : value));

  useEffect(() => setDraft(String(value)), [value]);

  const commit = (candidate: number) => {
    if (!options.length || !Number.isFinite(candidate)) {
      setDraft(String(value));
      return;
    }
    const next = Math.min(maximum, Math.max(minimum, Math.round(candidate)));
    setDraft(String(next));
    if (next !== value) onChange(next);
  };

  if (!options.length) return null;

  return (
    <section className={styles.section}>
      <div className={styles.durationHeading}>
        <h4>视频时长</h4>
        <label className={styles.durationInputWrap}>
          <input
            type="number"
            min={minimum}
            max={maximum}
            value={draft}
            aria-label="视频时长（秒）"
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => commit(Number(draft))}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commit(Number(draft));
                event.currentTarget.blur();
              }
            }}
          />
          <span>秒</span>
        </label>
      </div>
      <input
        className={styles.durationRange}
        type="range"
        min={minimum}
        max={maximum}
        step={1}
        value={sliderValue}
        aria-label="拖拽选择视频时长"
        onChange={(event) => setDraft(event.target.value)}
        onPointerUp={(event) => commit(Number(event.currentTarget.value))}
        onPointerCancel={() => setDraft(String(value))}
        onBlur={(event) => commit(Number(event.currentTarget.value))}
        onKeyUp={(event) => {
          if (
            ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"].includes(event.key)
          ) {
            commit(Number(event.currentTarget.value));
          }
        }}
      />
      <div className={styles.durationScale} aria-hidden="true">
        <span>{minimum}s</span>
        <span>{maximum}s</span>
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
  const selectedRatio = selectedDimension?.ratio ?? ratio;
  const summary = [
    selectedRatio,
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
          {qualities.length > 0 && (
            <ChoiceGroup label={qualityLabel} values={qualities} value={quality} onChange={onQualityChange} />
          )}
          {resolution && resolutions && onResolutionChange && (
            <ChoiceGroup
              label="清晰度"
              values={resolutions}
              value={resolution}
              format={(item) => item.toLowerCase()}
              onChange={onResolutionChange}
            />
          )}
          <section className={styles.section}>
            <h4>比例</h4>
            <div className={styles.ratioGrid}>
              {dimensions.map((item) => (
                <button
                  key={`${item.ratio}-${item.width}x${item.height}`}
                  type="button"
                  aria-pressed={item === selectedDimension}
                  className={`${styles.ratioChoice} ${item === selectedDimension ? styles.active : ""}`}
                  onClick={() => onDimensionChange(item)}
                >
                  <RatioMark option={item} />
                  <span>{item.ratio}</span>
                </button>
              ))}
            </div>
          </section>
          {duration !== undefined && durations && onDurationChange && (
            <DurationControl value={duration} values={durations} onChange={onDurationChange} />
          )}
          {counts.length > 1 && (
            <ChoiceGroup
              label="生成数量"
              values={counts.map(String)}
              value={String(count)}
              format={(item) => `${item}${countUnit}`}
              onChange={(item) => onCountChange(Number(item))}
            />
          )}
        </div>
      </Popover>
    </div>
  );
}
