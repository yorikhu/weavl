import { Injectable, OnModuleInit } from "@nestjs/common";
import { Client } from "minio";
import { Readable, Transform } from "node:stream";
import { newId } from "../../common/id";

export interface StoredContent {
  content: string | null;
  storageKey: string | null;
  size: number;
  mimeType: string;
}

@Injectable()
export class ObjectStorageService implements OnModuleInit {
  private readonly bucket = process.env.OBJECT_STORAGE_BUCKET || "weavl";
  private readonly client: Client;

  constructor() {
    const raw = process.env.OBJECT_STORAGE_ENDPOINT || "http://127.0.0.1:9000";
    const endpoint = new URL(raw);
    this.client = new Client({
      endPoint: endpoint.hostname,
      port: Number(endpoint.port || (endpoint.protocol === "https:" ? 443 : 80)),
      useSSL: endpoint.protocol === "https:",
      accessKey: process.env.OBJECT_STORAGE_ACCESS_KEY || "minioadmin",
      secretKey: process.env.OBJECT_STORAGE_SECRET_KEY || "minioadmin",
    });
  }

  /**
   * 初始化服务依赖。
   *
   * @returns 生命周期处理完成后的 Promise。
   */
  async onModuleInit() {
    if (!(await this.client.bucketExists(this.bucket))) await this.client.makeBucket(this.bucket);
  }

  /**
   * 持久化内联内容。
   *
   * @param content - 内联文本或 Data URL 内容。
   * @param mimeType - 内容 MIME 类型。
   * @param prefix - 对象存储键前缀。
   * @returns 持久化内联内容后的结果。
   */
  async persist(content: string, mimeType = "text/plain", prefix = "assets"): Promise<StoredContent> {
    const parsed = /^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.+)$/s.exec(content);
    if (!parsed) return { content, storageKey: null, size: Buffer.byteLength(content), mimeType };
    const resolvedMime = parsed[1] || mimeType;
    const buffer = Buffer.from(parsed[2]!, "base64");
    const extension = this.extension(resolvedMime);
    const storageKey = `${prefix}/${new Date().toISOString().slice(0, 10)}/${newId("file")}${extension}`;
    await this.client.putObject(this.bucket, storageKey, buffer, buffer.length, { "Content-Type": resolvedMime });
    return { content: null, storageKey, size: buffer.length, mimeType: resolvedMime };
  }

  /**
   * 将模型服务返回的临时 HTTP(S) 产物流式固化到对象存储。
   * 非 HTTP 内容回退到 persist，因此调用方可以统一传入 data URL 或远程地址。
   *
   * @param url - 供应商临时 HTTP(S) 地址或可由 persist 处理的内联内容。
   * @param mimeType - 供应商声明的媒体类型，响应头存在时以后者为准。
   * @param prefix - MinIO 对象键目录前缀。
   * @returns 已持久化内容的位置、大小和最终 MIME 类型。
   * @throws {Error} 远程文件下载失败或响应不含数据流时抛出。
   */
  async persistRemote(url: string, mimeType: string, prefix = "assets"): Promise<StoredContent> {
    if (!/^https?:\/\//i.test(url)) return this.persist(url, mimeType, prefix);
    const response = await fetch(url);
    if (!response.ok || !response.body) throw new Error(`下载生成产物失败：${response.status}`);
    const resolvedMime = response.headers.get("content-type")?.split(";")[0] || mimeType;
    const storageKey = `${prefix}/${new Date().toISOString().slice(0, 10)}/${newId("file")}${this.extension(resolvedMime)}`;
    let streamedSize = 0;
    const counter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        streamedSize += chunk.length;
        callback(null, chunk);
      },
    });
    const stream = Readable.fromWeb(response.body as never).pipe(counter);
    const contentLength = Number(response.headers.get("content-length")) || undefined;
    await this.client.putObject(this.bucket, storageKey, stream, contentLength, { "Content-Type": resolvedMime });
    return { content: null, storageKey, size: contentLength || streamedSize, mimeType: resolvedMime };
  }

  /**
   * 将客户端上传流直接写入对象存储，不在 API 进程中构造 Data URL 或完整文件缓冲区。
   *
   * @param stream - 客户端请求提供的可读文件流。
   * @param mimeType - 客户端声明并由控制器校验过的媒体类型。
   * @param contentLength - 可选的请求体字节数；未知时由 MinIO 流式分片处理。
   * @param prefix - 对象存储键前缀。
   * @returns 已写入对象的位置、实际字节数和 MIME 类型。
   */
  async persistStream(
    stream: Readable,
    mimeType: string,
    contentLength: number | undefined,
    prefix = "assets",
  ): Promise<StoredContent> {
    const storageKey = `${prefix}/${new Date().toISOString().slice(0, 10)}/${newId("file")}${this.extension(mimeType)}`;
    let streamedSize = 0;
    const counter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        streamedSize += chunk.length;
        callback(null, chunk);
      },
    });
    await this.client.putObject(this.bucket, storageKey, stream.pipe(counter), contentLength, {
      "Content-Type": mimeType,
    });
    return { content: null, storageKey, size: contentLength ?? streamedSize, mimeType };
  }

  /**
   * 解析对象存储访问地址。
   *
   * @param content - 内联文本或 Data URL 内容。
   * @param storageKey - 对象存储键。
   * @returns 解析对象存储访问地址后的结果。
   */
  async resolve(content: string | null, storageKey: string | null): Promise<string> {
    if (storageKey) return this.client.presignedGetObject(this.bucket, storageKey, 24 * 60 * 60);
    return content || "";
  }

  /**
   * 读取已持久化媒体的原始字节，供模型参考图等服务端调用使用。
   *
   * @param content - 旧数据中的 Data URL 或远程内容地址。
   * @param storageKey - MinIO 对象键。
   * @param fallbackMimeType - 数据未携带类型时使用的 MIME 类型。
   * @returns 媒体字节与最终 MIME 类型。
   * @throws {Error} 内容不存在或远程内容无法读取时抛出。
   */
  async read(content: string | null, storageKey: string | null, fallbackMimeType: string) {
    if (storageKey) {
      const stream = await this.client.getObject(this.bucket, storageKey);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      return { data: Buffer.concat(chunks), mimeType: fallbackMimeType };
    }
    const inline = /^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.+)$/s.exec(content || "");
    if (inline) return { data: Buffer.from(inline[2]!, "base64"), mimeType: inline[1] || fallbackMimeType };
    if (/^https?:\/\//i.test(content || "")) {
      const response = await fetch(content!);
      if (!response.ok) throw new Error(`读取参考素材失败：${response.status}`);
      return {
        data: Buffer.from(await response.arrayBuffer()),
        mimeType: response.headers.get("content-type")?.split(";")[0] || fallbackMimeType,
      };
    }
    throw new Error("参考素材没有可读取的媒体内容");
  }

  /**
   * 删除对象存储内容。
   *
   * @param storageKey - 对象存储键。
   * @returns 删除对象存储内容后的结果。
   */
  async remove(storageKey: string | null | undefined) {
    if (storageKey) await this.client.removeObject(this.bucket, storageKey);
  }

  /**
   * 检查对象存储健康状态。
   *
   * @returns 检查对象存储健康状态后的结果。
   */
  async health() {
    return this.client.bucketExists(this.bucket);
  }

  private extension(mimeType: string) {
    const extensions: Record<string, string> = {
      "image/png": ".png",
      "image/jpeg": ".jpg",
      "image/webp": ".webp",
      "video/mp4": ".mp4",
      "audio/mpeg": ".mp3",
      "application/pdf": ".pdf",
    };
    return extensions[mimeType] || "";
  }
}
