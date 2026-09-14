"use client";

import type { RefObject } from "react";
import { X } from "lucide-react";
import { BASIC_NODE_CHOICES, NODE_LIBRARY } from "../../constants";
import { KIND_META } from "../../types/kindMeta";
import type { BasicNodeKind } from "../../types/nodes";
import styles from "./index.module.scss";

interface CanvasNodeLibraryProps {
  libraryRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onAddBasic: (kind: BasicNodeKind) => void;
  onAddFromLibrary: (index: number) => void;
}

export function CanvasNodeLibrary({ libraryRef, onClose, onAddBasic, onAddFromLibrary }: CanvasNodeLibraryProps) {
  return (
    <div className={styles.libraryBackdrop} onClick={onClose}>
      <div ref={libraryRef} className={styles.library} onClick={(event) => event.stopPropagation()}>
        <div className={styles.libraryHead}>
          <span>节点库</span>
          <button onClick={onClose} aria-label="关闭">
            <X size={14} />
          </button>
        </div>
        <div className={styles.librarySectionLabel}>基础节点</div>
        <div className={styles.basicGrid}>
          {BASIC_NODE_CHOICES.map(({ kind, label, hint, icon: Icon }) => (
            <button key={kind} className={styles.basicItem} onClick={() => onAddBasic(kind)}>
              <div
                className={`${styles.basicIcon} ${kind === "image" ? styles.basicImage : ""} ${kind === "video" ? styles.basicVideo : ""}`}
              >
                <Icon size={16} />
              </div>
              <span>{label}</span>
              <span className={styles.basicHint}>{hint}</span>
            </button>
          ))}
        </div>

        <div className={styles.librarySectionLabel} style={{ marginTop: 14 }}>
          业务能力
        </div>
        <div className={styles.libraryGrid}>
          {NODE_LIBRARY.map((item, index) => {
            const meta = KIND_META[item.kind];
            return (
              <button
                key={`${item.kind}-${item.title}`}
                className={styles.libraryItem}
                onClick={() => onAddFromLibrary(index)}
                style={{ borderColor: meta.color.stroke, background: meta.color.bg }}
              >
                <div className={styles.libraryTop}>
                  <span
                    className={styles.libraryCategory}
                    style={{ color: meta.color.text, background: meta.color.stroke + "33" }}
                  >
                    {item.category}
                  </span>
                  <span className={styles.libraryType} style={{ color: meta.color.text }}>
                    {item.title}
                  </span>
                </div>
                <span className={styles.libraryMeta} style={{ color: meta.color.soft }}>
                  {item.meta}
                </span>
                {item.nodeKind === "card" && (
                  <div className={styles.libraryFields}>
                    {item.fields.slice(0, 3).map((field, fieldIndex) => (
                      <div key={fieldIndex} className={styles.libraryField}>
                        <span className={styles.libraryFieldLabel}>{field.label}</span>
                        <span className={styles.libraryFieldValue}>{field.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
