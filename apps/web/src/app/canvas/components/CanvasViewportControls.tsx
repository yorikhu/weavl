"use client";

import { useCallback, useState } from "react";
import { useReactFlow, useViewport } from "@xyflow/react";
import { LocateFixed, Minus, Plus } from "lucide-react";
import { Popover } from "@/components/Popover";
import styles from "../page.module.scss";

/** 视口变化只重渲染控件，不重渲染画布节点树。 */
export function CanvasViewportControls() {
  const { zoomIn, zoomOut, zoomTo, fitView } = useReactFlow();
  const { zoom } = useViewport();
  const [zoomMenuOpen, setZoomMenuOpen] = useState(false);
  const [zoomDraft, setZoomDraft] = useState("80");

  const applyZoomPercent = useCallback(
    (percent: number, closeMenu = false) => {
      const clamped = Math.min(250, Math.max(30, percent));
      setZoomDraft(String(Math.round(clamped)));
      void zoomTo(clamped / 100, { duration: 180 });
      if (closeMenu) setZoomMenuOpen(false);
    },
    [zoomTo],
  );

  const commitZoomDraft = useCallback(
    (closeMenu = false) => {
      const parsed = Number.parseFloat(zoomDraft);
      if (!Number.isFinite(parsed)) {
        setZoomDraft(String(Math.round(zoom * 100)));
        return;
      }
      applyZoomPercent(parsed, closeMenu);
    },
    [applyZoomPercent, zoom, zoomDraft],
  );

  return (
    <div className={styles.viewportControls} aria-label="画布缩放控制">
      <button type="button" onClick={() => void zoomIn({ duration: 180 })} aria-label="放大画布" title="放大">
        <Plus size={14} />
      </button>
      <button type="button" onClick={() => void zoomOut({ duration: 180 })} aria-label="缩小画布" title="缩小">
        <Minus size={14} />
      </button>
      <button
        type="button"
        onClick={() => void fitView({ padding: 0.2, maxZoom: 1, duration: 260 })}
        aria-label="定位全部节点"
        title="定位全部节点"
      >
        <LocateFixed size={14} />
      </button>
      <span className={styles.viewportControlsDivider} aria-hidden="true" />
      <Popover
        mode="click"
        open={zoomMenuOpen}
        onOpenChange={(open) => {
          setZoomMenuOpen(open);
          if (open) setZoomDraft(String(Math.round(zoom * 100)));
        }}
        side="top"
        align="end"
        sideOffset={8}
        showArrow={false}
        ariaLabel="设置画布缩放比例"
        contentClassName={styles.zoomPopover}
        trigger={
          <button
            type="button"
            className={`${styles.zoomTrigger} ${zoomMenuOpen ? styles.zoomTriggerOpen : ""}`}
            aria-label={`当前画布比例 ${Math.round(zoom * 100)}%`}
            aria-expanded={zoomMenuOpen}
          >
            {Math.round(zoom * 100)}%
          </button>
        }
      >
        <label className={styles.zoomInputRow}>
          <span>缩放比例</span>
          <span className={styles.zoomInputWrap}>
            <input
              type="number"
              min={30}
              max={250}
              step={5}
              value={zoomDraft}
              onChange={(event) => setZoomDraft(event.target.value)}
              onBlur={() => commitZoomDraft()}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitZoomDraft(true);
                }
              }}
              aria-label="画布缩放百分比"
            />
            <span>%</span>
          </span>
        </label>
        <button type="button" className={styles.zoomPreset} onClick={() => applyZoomPercent(50, true)}>
          <span>适合概览</span>
          <strong>50%</strong>
        </button>
        <button type="button" className={styles.zoomPreset} onClick={() => applyZoomPercent(100, true)}>
          <span>实际大小</span>
          <strong>100%</strong>
        </button>
        <button type="button" className={styles.zoomPreset} onClick={() => applyZoomPercent(200, true)}>
          <span>细节查看</span>
          <strong>200%</strong>
        </button>
      </Popover>
    </div>
  );
}
