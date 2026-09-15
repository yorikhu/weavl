"use client";

import { useState } from "react";
import type { AriaRole, ReactElement, ReactNode } from "react";
import { Popover as PopoverPrimitive, Tooltip as TooltipPrimitive } from "radix-ui";

import styles from "./index.module.scss";

type Side = "top" | "right" | "bottom" | "left";
type Align = "start" | "center" | "end";

/** Popover 的触发方式、定位、受控开关及内容样式属性。 */
export interface PopoverProps {
  mode?: "click" | "hover";
  variant?: "default" | "action";
  trigger: ReactElement;
  children: ReactNode;
  side?: Side;
  align?: Align;
  sideOffset?: number;
  collisionPadding?: number;
  contentClassName?: string;
  ariaLabel?: string;
  contentRole?: AriaRole;
  showArrow?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hint?: ReactNode;
  hintAlign?: Align;
  preserveOpenOnOutsideSelector?: string;
  autoFocusOnOpen?: boolean;
  openWhen?: (element: HTMLElement) => boolean;
}

const classes = (...names: Array<string | undefined>) => names.filter(Boolean).join(" ");

/**
 * 全局浮层。hover 用于即时提示，click 用于菜单等可交互内容；action 提供紧凑操作面板样式。
 */
export function Popover({
  mode = "click",
  variant = "default",
  trigger,
  children,
  side = "top",
  align,
  sideOffset,
  collisionPadding = 12,
  contentClassName,
  ariaLabel,
  contentRole,
  showArrow,
  open,
  onOpenChange,
  hint,
  hintAlign,
  preserveOpenOnOutsideSelector,
  autoFocusOnOpen = true,
  openWhen,
}: PopoverProps) {
  const [hoverOpen, setHoverOpen] = useState(false);
  const [internalClickOpen, setInternalClickOpen] = useState(false);
  const resolvedAlign = align ?? (variant === "action" && mode === "click" ? "start" : "center");
  const resolvedHintAlign = hintAlign ?? resolvedAlign;
  const resolvedSideOffset = sideOffset ?? (variant === "action" ? 4 : 2);
  const resolvedShowArrow = showArrow ?? variant !== "action";

  if (mode === "hover") {
    return (
      <TooltipPrimitive.Provider delayDuration={0} skipDelayDuration={0}>
        <TooltipPrimitive.Root open={hoverOpen} disableHoverableContent>
          <TooltipPrimitive.Trigger
            asChild
            onPointerEnter={(event) => {
              const element = event.currentTarget as HTMLElement;
              setHoverOpen(openWhen ? openWhen(element) : true);
            }}
            onPointerLeave={() => setHoverOpen(false)}
          >
            {trigger}
          </TooltipPrimitive.Trigger>
          <TooltipPrimitive.Portal>
            <TooltipPrimitive.Content
              className={classes(styles.content, styles.hoverContent, contentClassName)}
              side={side}
              align={resolvedAlign}
              sideOffset={resolvedSideOffset}
              collisionPadding={collisionPadding}
              aria-label={ariaLabel}
            >
              {children}
              {resolvedShowArrow && <TooltipPrimitive.Arrow className={styles.arrow} width={12} height={6} />}
            </TooltipPrimitive.Content>
          </TooltipPrimitive.Portal>
        </TooltipPrimitive.Root>
      </TooltipPrimitive.Provider>
    );
  }

  const clickOpen = open ?? internalClickOpen;
  const clickTrigger = <PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger>;
  const handleClickOpenChange = (nextOpen: boolean) => {
    if (nextOpen) setHoverOpen(false);
    if (open === undefined) setInternalClickOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };

  return (
    <TooltipPrimitive.Provider delayDuration={0} skipDelayDuration={0}>
      <TooltipPrimitive.Root open={hoverOpen && !clickOpen} disableHoverableContent>
        <PopoverPrimitive.Root open={clickOpen} onOpenChange={handleClickOpenChange}>
          {hint ? (
            <TooltipPrimitive.Trigger
              asChild
              onPointerEnter={() => setHoverOpen(true)}
              onPointerLeave={() => setHoverOpen(false)}
            >
              {clickTrigger}
            </TooltipPrimitive.Trigger>
          ) : (
            clickTrigger
          )}
          {hint && (
            <TooltipPrimitive.Portal>
              <TooltipPrimitive.Content
                className={classes(styles.content, styles.hoverContent)}
                side={side}
                align={resolvedHintAlign}
                sideOffset={resolvedSideOffset}
                collisionPadding={collisionPadding}
              >
                {hint}
                {resolvedShowArrow && <TooltipPrimitive.Arrow className={styles.arrow} width={12} height={6} />}
              </TooltipPrimitive.Content>
            </TooltipPrimitive.Portal>
          )}
          {clickOpen && (
            <PopoverPrimitive.Portal>
              <PopoverPrimitive.Content
                className={classes(
                  styles.content,
                  styles.clickContent,
                  variant === "action" ? styles.actionContent : undefined,
                  contentClassName,
                )}
                side={side}
                align={resolvedAlign}
                sideOffset={resolvedSideOffset}
                collisionPadding={collisionPadding}
                aria-label={ariaLabel}
                role={contentRole}
                onOpenAutoFocus={(event) => {
                  if (!autoFocusOnOpen) event.preventDefault();
                }}
                onCloseAutoFocus={(event) => event.preventDefault()}
                onInteractOutside={(event) => {
                  const target = event.detail.originalEvent.target;
                  if (
                    preserveOpenOnOutsideSelector &&
                    target instanceof Element &&
                    target.closest(preserveOpenOnOutsideSelector)
                  ) {
                    event.preventDefault();
                  }
                }}
              >
                {children}
                {resolvedShowArrow && <PopoverPrimitive.Arrow className={styles.arrow} width={12} height={6} />}
              </PopoverPrimitive.Content>
            </PopoverPrimitive.Portal>
          )}
        </PopoverPrimitive.Root>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
