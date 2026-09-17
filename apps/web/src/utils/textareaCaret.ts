/**
 * 受控多行输入框超过可视区域后，保持光标所在行可见。
 *
 * @param textarea - 目标多行输入框。
 * @param caret - 当前光标偏移量。
 * @returns 无返回值。
 */
export function scrollCaretIntoView(textarea: HTMLTextAreaElement, caret: number) {
  if (caret === textarea.value.length) {
    textarea.scrollTop = textarea.scrollHeight;
    return;
  }

  const style = getComputedStyle(textarea);
  const mirror = document.createElement("div");
  Object.assign(mirror.style, {
    position: "absolute",
    left: "-9999px",
    width: `${textarea.clientWidth}px`,
    boxSizing: "border-box",
    padding: style.padding,
    font: style.font,
    letterSpacing: style.letterSpacing,
    lineHeight: style.lineHeight,
    whiteSpace: "pre-wrap",
    overflowWrap: style.overflowWrap,
    wordBreak: style.wordBreak,
    tabSize: style.tabSize,
    visibility: "hidden",
  });
  mirror.append(document.createTextNode(textarea.value.slice(0, caret)));
  const marker = document.createElement("span");
  marker.textContent = "\u200b";
  mirror.append(marker);
  document.body.append(mirror);
  const caretTop = marker.offsetTop;
  mirror.remove();

  const lineHeight = Number.parseFloat(style.lineHeight) || 20;
  if (caretTop < textarea.scrollTop) textarea.scrollTop = caretTop;
  else if (caretTop + lineHeight > textarea.scrollTop + textarea.clientHeight)
    textarea.scrollTop = caretTop + lineHeight - textarea.clientHeight;
}

/**
 * 下一帧将位于文本末尾的光标滚动到可视区域。
 *
 * @param textarea - 目标多行输入框。
 * @param caret - 当前光标偏移量。
 * @returns 无返回值。
 */
export function scrollToLatestLine(textarea: HTMLTextAreaElement, caret: number) {
  window.requestAnimationFrame(() => {
    if (textarea.isConnected && caret === textarea.value.length) textarea.scrollTop = textarea.scrollHeight;
  });
}
