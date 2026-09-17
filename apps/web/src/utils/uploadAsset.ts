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
 * @throws {Error} 文件超过当前前端传输上限或上传失败时抛出。
 * @todo 改为 multipart 或预签名直传后移除 5 MB 的 Data URL 传输限制。
 */
export async function uploadAsset(file: File, folderId: string | null = null, inLibrary = true): Promise<Asset> {
  if (file.size > 5_000_000) throw new Error("演示存储单个文件上限为 5 MB；正式对象存储接入后可上传大文件。");
  return studioApi<Asset>("/studio/assets", {
    method: "POST",
    body: jsonBody({
      name: file.name,
      kind: kindFor(file),
      content: await readFile(file),
      mimeType: file.type,
      folderId,
      inLibrary,
    }),
  });
}
