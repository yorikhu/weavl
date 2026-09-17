import type { Asset, AssetKind } from "@weavl/shared";
import { jsonBody, studioApi } from "@/lib/studioApi";

function kindFor(file: File): AssetKind {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type === "application/pdf") return "pdf";
  if (/presentation|powerpoint/.test(file.type)) return "ppt";
  if (/word|document/.test(file.type)) return "word";
  if (file.type.startsWith("text/")) return "text";
  return "file";
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * 读取本地文件并通过资产 API 保存到对象存储。
 *
 * @param file - 用户选择的本地文件。
 * @param folderId - 可选目标资产文件夹。
 * @param inLibrary - 是否立即加入全局资产库。
 * @returns 服务端创建的资产。
 * 图片和视频使用原始请求流写入对象存储，不受 JSON/Data URL 体积上限影响；
 * 其他轻量文件暂时沿用内联传输。
 *
 * @throws {Error} 非媒体文件超过当前内联传输上限或上传失败时抛出。
 */
export async function uploadAsset(file: File, folderId: string | null = null, inLibrary = true): Promise<Asset> {
  const kind = kindFor(file);
  if (kind === "image" || kind === "video") {
    return studioApi<Asset>("/studio/assets/upload", {
      method: "POST",
      headers: {
        "Content-Type": file.type || "application/octet-stream",
        "X-File-Name": encodeURIComponent(file.name),
        "X-Asset-Kind": kind,
        "X-Folder-Id": folderId || "",
        "X-In-Library": inLibrary ? "1" : "0",
      },
      body: file,
    });
  }
  if (file.size > 5_000_000) throw new Error("当前仅图片和视频支持大文件上传。");
  return studioApi<Asset>("/studio/assets", {
    method: "POST",
    body: jsonBody({
      name: file.name,
      kind,
      content: await readFile(file),
      mimeType: file.type,
      folderId,
      inLibrary,
    }),
  });
}
