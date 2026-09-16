import { Module } from "@nestjs/common";
import { LegacyImportService } from "./legacy-import.service";
@Module({ providers: [LegacyImportService] })
export class BootstrapModule {}
