import "reflect-metadata";
import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

/** 启动不监听 HTTP 端口的 BullMQ 后台消费进程。 */
async function bootstrap() {
  process.env.WEAVL_RUN_GENERATION_WORKER = "true";
  await NestFactory.createApplicationContext(AppModule);
  console.log("[weavl/worker] generation task worker started");
}

void bootstrap();
