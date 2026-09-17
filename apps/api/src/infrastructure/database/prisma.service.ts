import { Injectable, OnApplicationShutdown, OnModuleInit } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

/** Shared Prisma client. Feature services own queries; this class only manages the connection lifecycle. */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnApplicationShutdown {
  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL 未配置");
    super({ adapter: new PrismaPg(connectionString) });
  }

  /**
   * 初始化服务依赖。
   *
   * @returns 生命周期处理完成后的 Promise。
   */
  async onModuleInit() {
    await this.$connect();
  }

  /**
   * 关闭服务持有的外部连接。
   *
   * @returns 生命周期处理完成后的 Promise。
   */
  async onApplicationShutdown() {
    await this.$disconnect();
  }
}
