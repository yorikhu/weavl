"use client";

import { createContext, type MutableRefObject } from "react";
import type { AssetRef } from "@weavl/shared";
import type { MediaNodeVariant } from "./types/nodes";

/**
 * 画布编辑态共享 context：
 * - editingId / editingKind：当前编辑的节点
 * - buffer：编辑中的临时数据（标题 + 文本）
 * - enterEdit/saveEdit/commitEdit：进入、保存、提交
 * - focusNode：只负责将视口聚焦到节点，不改变编辑状态
 * - commitImageEdit / commitVideoEdit：图片/视频节点编辑提交
 * - editorElRef / composingRef：contentEditable DOM 引用 + IME 状态
 * - imageEditStateRef / videoEditStateRef：图片/视频编辑面板的实时 ref（点外部保存时取最新值）
 */
export interface EditCtx {
  editingId: string | null;
  editingKind: string | null;
  editingMode: "manual" | "generate";
  buffer: { title: string; text: string };
  setBuffer: (b: { title: string; text: string }) => void;
  enterEdit: (id: string, mode?: "manual" | "generate") => void;
  focusNode: (id: string, options?: { leftInset?: number }) => void;
  saveEdit: (id: string, title: string, text: string) => void;
  commitEdit: () => void;
  commitImageEdit:
    | ((
        id: string,
        payload: {
          prompt?: string;
          ratio?: string;
          quality?: string;
          resolution?: string;
          generationSize?: { width: number; height: number };
          size?: { w: number; h: number };
          count?: number;
          model?: string;
          url?: string;
          assetRef?: AssetRef;
          variants?: MediaNodeVariant[];
          title?: string;
          generationStatus?: "succeeded";
        },
      ) => void)
    | null;
  commitVideoEdit:
    | ((
        id: string,
        payload: {
          prompt?: string;
          ratio?: string;
          quality?: string;
          generationSize?: { width: number; height: number };
          size?: { w: number; h: number };
          duration?: number;
          count?: number;
          model?: string;
          url?: string;
          assetRef?: AssetRef;
          variants?: MediaNodeVariant[];
          title?: string;
          generationStatus?: "succeeded";
          generationJobId?: string;
        },
      ) => void)
    | null;
  exitEdit: () => void;
  focusMode: { nodeId: string | null };
  onApplyFormat: (cmd: string, value?: string) => void;
  editorElRef: MutableRefObject<HTMLDivElement | null>;
  composingRef: MutableRefObject<boolean>;
  imageEditStateRef: MutableRefObject<{
    prompt?: string;
    ratio?: string;
    quality?: string;
    resolution?: string;
    generationSize?: { width: number; height: number };
    count?: number;
    model?: string;
    url?: string;
    assetRef?: AssetRef;
    variants?: MediaNodeVariant[];
  } | null>;
  videoEditStateRef: MutableRefObject<{
    prompt?: string;
    ratio?: string;
    quality?: string;
    generationSize?: { width: number; height: number };
    duration?: number;
    count?: number;
    model?: string;
    url?: string;
    assetRef?: AssetRef;
    variants?: MediaNodeVariant[];
    title?: string;
  } | null>;
}

export const EnterEditContext = createContext<EditCtx>({
  editingId: null,
  editingKind: null,
  editingMode: "manual",
  buffer: { title: "", text: "" },
  setBuffer: () => {},
  enterEdit: () => {},
  focusNode: () => {},
  saveEdit: () => {},
  commitEdit: () => {},
  commitImageEdit: null,
  commitVideoEdit: null,
  exitEdit: () => {},
  focusMode: { nodeId: null },
  onApplyFormat: () => {},
  editorElRef: { current: null },
  composingRef: { current: false },
  imageEditStateRef: { current: null },
  videoEditStateRef: { current: null },
});
