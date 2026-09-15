"use client";

import { Modal } from "@/components/Modal";

export interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
  onOpenChange: (open: boolean) => void;
}

/** 需要用户明确确认后才能继续的通用操作弹窗。 */
export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "确认",
  cancelLabel = "取消",
  danger = false,
  busy = false,
  onConfirm,
  onOpenChange,
}: ConfirmModalProps) {
  return (
    <Modal open={open} title={title} description={description} busy={busy} onOpenChange={onOpenChange}>
      <Modal.Footer>
        <Modal.Button type="button" variant="quiet" disabled={busy} onClick={() => onOpenChange(false)}>
          {cancelLabel}
        </Modal.Button>
        <Modal.Button
          type="button"
          variant={danger ? "danger" : "primary"}
          disabled={busy}
          onClick={() => void onConfirm()}
        >
          {busy ? "处理中…" : confirmLabel}
        </Modal.Button>
      </Modal.Footer>
    </Modal>
  );
}
