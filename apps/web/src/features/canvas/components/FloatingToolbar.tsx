"use client";

import { useContext } from "react";
import { Minus, Pilcrow, RemoveFormatting } from "lucide-react";
import { EnterEditContext } from "@/features/canvas/editContext";
import styles from "@/app/canvas/page.module.scss";

/**
 * 渲染文本节点聚焦时使用的浮动富文本工具栏。
 *
 * @returns 未聚焦文本节点时返回 `null`，否则返回格式化工具栏。
 */
export function FloatingToolbar() {
  const edit = useContext(EnterEditContext);
  if (!edit.focusMode.nodeId) return null;
  /** 图片/视频节点编辑态不显示富文本工具栏（改名走节点上方标题输入框） */
  if (edit.editingKind === "image" || edit.editingKind === "video") return null;
  const apply = (cmd: string, value?: string) => edit.onApplyFormat(cmd, value);

  return (
    <div className={styles.floatingToolbar}>
      <select
        className={styles.tbSelect}
        onChange={(e) => {
          apply("fontName", e.target.value);
          e.currentTarget.selectedIndex = 0;
        }}
        defaultValue=""
      >
        <option value="" disabled>
          字体
        </option>
        <option value="PingFang SC">PingFang</option>
        <option value="system-ui">系统</option>
        <option value="serif">衬线</option>
        <option value="monospace">等宽</option>
      </select>
      <select
        className={styles.tbSelectNarrow}
        onChange={(e) => {
          apply("fontSize", e.target.value);
          e.currentTarget.selectedIndex = 0;
        }}
        defaultValue=""
      >
        <option value="" disabled>
          14
        </option>
        <option value="3">12</option>
        <option value="4">14</option>
        <option value="5">18</option>
        <option value="6">24</option>
        <option value="7">32</option>
      </select>
      <span className={styles.tbSep} />
      <button className={styles.tbBtn} title="加粗" onClick={() => apply("bold")}>
        <b>B</b>
      </button>
      <button className={styles.tbBtn} title="斜体" onClick={() => apply("italic")}>
        <i>I</i>
      </button>
      <button className={styles.tbBtn} title="下划线" onClick={() => apply("underline")}>
        <u>U</u>
      </button>
      <button className={styles.tbBtn} title="删除线" onClick={() => apply("strikeThrough")}>
        <s>S</s>
      </button>
      <span className={styles.tbBtn} title="字体颜色">
        <input
          type="color"
          defaultValue="#e6e8ec"
          className={styles.tbColor}
          onChange={(e) => apply("foreColor", e.target.value)}
        />
      </span>
      <span className={styles.tbBtn} title="背景高亮">
        <input
          type="color"
          defaultValue="#f59e0b"
          className={styles.tbColor}
          onChange={(e) => apply("hiliteColor", e.target.value)}
        />
      </span>
      <span className={styles.tbSep} />
      <button className={styles.tbBtn} title="居左" onClick={() => apply("justifyLeft")}>
        ≡
      </button>
      <button className={styles.tbBtn} title="居中" onClick={() => apply("justifyCenter")}>
        ≣
      </button>
      <button className={styles.tbBtn} title="居右" onClick={() => apply("justifyRight")}>
        ≡
      </button>
      <span className={styles.tbSep} />
      <button className={styles.tbBtn} title="无序列表" onClick={() => apply("insertUnorderedList")}>
        •
      </button>
      <button className={styles.tbBtn} title="有序列表" onClick={() => apply("insertOrderedList")}>
        1.
      </button>
      <span className={styles.tbBtn} title="减少缩进" onClick={() => apply("outdent")}>
        <Minus size={12} />
      </span>
      <span className={styles.tbBtn} title="增加缩进" onClick={() => apply("indent")}>
        <Pilcrow size={12} />
      </span>
      <span className={styles.tbSep} />
      <button
        className={styles.tbBtn}
        title="链接"
        onClick={() => {
          const url = window.prompt("输入链接 URL");
          if (url) apply("createLink", url);
        }}
      >
        ⌘
      </button>
      <button className={styles.tbBtn} title="清除格式" onClick={() => apply("removeFormat")}>
        <RemoveFormatting size={12} />
      </button>
    </div>
  );
}
