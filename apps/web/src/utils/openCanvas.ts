type CanvasDestination = { projectId: string; canvasId: string };

export function canvasHref({ projectId, canvasId }: CanvasDestination) {
  return `/canvas?${new URLSearchParams({ projectId, canvasId })}`;
}

function openTab(url: string) {
  const tab = window.open(url, "_blank");
  if (tab) tab.opener = null;
  else window.location.assign(url);
}

/** 在点击事件中预留标签页，异步创建项目完成后再跳转，避免被弹窗拦截。 */
export async function openCanvasAfter(resolve: () => Promise<CanvasDestination>) {
  const tab = window.open("about:blank", "_blank");
  if (tab) tab.opener = null;

  try {
    const destination = await resolve();
    const url = canvasHref(destination);
    if (tab && !tab.closed) tab.location.replace(url);
    else openTab(url);
  } catch (cause) {
    tab?.close();
    throw cause;
  }
}
