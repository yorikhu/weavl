import "reflect-metadata";
import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api");
  const allowedOrigins = (process.env.WEAVL_WEB_ORIGINS || "http://localhost:3000")
    .split(",")
    .map((value) => value.trim());
  app.enableCors({ origin: allowedOrigins, credentials: true });
  const port = Number(process.env.PORT || 3001);
  await app.listen(port);
  console.log(`[weavl/api] listening on http://localhost:${port}/api`);
}

void bootstrap();
