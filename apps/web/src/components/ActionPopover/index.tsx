"use client";

import { Popover, type PopoverProps } from "@/components/Popover";
import styles from "./index.module.scss";

type ActionPopoverProps = Omit<PopoverProps, "mode" | "showArrow"> & {
  mode?: PopoverProps["mode"];
};

/** 操作入口统一使用无箭头的悬停提示与点击面板。 */
export function ActionPopover({
  mode = "click",
  align,
  side = "top",
  sideOffset = 4,
  contentClassName,
  ...props
}: ActionPopoverProps) {
  return (
    <Popover
      {...props}
      mode={mode}
      showArrow={false}
      side={side}
      align={align ?? (mode === "hover" ? "center" : "start")}
      sideOffset={sideOffset}
      contentClassName={mode === "click" ? [styles.panel, contentClassName].filter(Boolean).join(" ") : contentClassName}
    />
  );
}
