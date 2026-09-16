import { Module } from "@nestjs/common";
import { AssetsController, FoldersController } from "./assets.controller";
import { AssetsService } from "./assets.service";
@Module({ controllers: [AssetsController, FoldersController], providers: [AssetsService], exports: [AssetsService] })
export class AssetsModule {}
