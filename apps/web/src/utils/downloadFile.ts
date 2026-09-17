/** MIME 类型与常见文件扩展名的对应关系。 */
const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

/**
 * 创建临时链接并触发浏览器下载。
 *
 * @param href - 可下载的远程地址、Data URL 或 Object URL。
 * @param filename - 下载时展示的文件名。
 */
function triggerDownload(href: string, filename: string) {
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.rel = "noopener noreferrer";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

/**
 * 保留已有扩展名，缺少扩展名时根据响应 MIME 类型补全。
 *
 * @param filename - 用户可见的原始文件名。
 * @param mimeType - 下载响应的 MIME 类型。
 * @returns 适合写入本地文件系统的文件名。
 */
function resolveFilename(filename: string, mimeType: string) {
  const safeName = filename.trim().replaceAll(/[\\/:*?"<>|]/g, "-") || "下载文件";
  if (/\.[a-z0-9]{2,5}$/i.test(safeName)) return safeName;
  const extension = MIME_EXTENSIONS[mimeType.split(";")[0]?.toLowerCase() ?? ""];
  return extension ? `${safeName}.${extension}` : safeName;
}

/**
 * 下载远程或内嵌文件。优先转换为同源 Object URL，跨域服务禁止读取时回退到原始地址。
 *
 * @param url - 文件地址。
 * @param filename - 用户可见的下载文件名。
 */
export async function downloadFile(url: string, filename: string) {
  try {
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) throw new Error(`下载请求失败 (${response.status})`);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    triggerDownload(objectUrl, resolveFilename(filename, blob.type));
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
  } catch {
    triggerDownload(url, filename);
  }
}
