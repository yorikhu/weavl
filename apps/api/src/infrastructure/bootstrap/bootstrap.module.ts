import { Module } from "@nestjs/common";
import { LegacyImportService } from "./legacy-import.service";

/** 注册数据库首次启动与旧版数据迁移能力。 */
@Module({ providers: [LegacyImportService] })
export class BootstrapModule {}
