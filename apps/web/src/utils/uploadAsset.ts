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

/** 当前本地演示存储使用 Data URL；换成对象存储时只需替换此处。 */
export async function uploadAsset(file: File, folderId: string | null = null): Promise<Asset> {
  if (file.size > 5_000_000) throw new Error("演示存储单个文件上限为 5 MB；正式对象存储接入后可上传大文件。");
  return studioApi<Asset>("/studio/assets", {
    method: "POST",
    body: jsonBody({
      name: file.name,
      kind: kindFor(file),
      content: await readFile(file),
      mimeType: file.type,
      folderId,
    }),
  });
}
