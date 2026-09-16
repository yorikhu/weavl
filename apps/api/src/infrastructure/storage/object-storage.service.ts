import { Injectable, OnModuleInit } from "@nestjs/common";
import { Client } from "minio";
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

  async onModuleInit() {
    if (!(await this.client.bucketExists(this.bucket))) await this.client.makeBucket(this.bucket);
  }

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

  async resolve(content: string | null, storageKey: string | null): Promise<string> {
    if (storageKey) return this.client.presignedGetObject(this.bucket, storageKey, 24 * 60 * 60);
    return content || "";
  }

  async remove(storageKey: string | null | undefined) {
    if (storageKey) await this.client.removeObject(this.bucket, storageKey);
  }

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
