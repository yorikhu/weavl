import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({ origin: true, credentials: true });
  await app.listen(3001);
  // eslint-disable-next-line no-console
  console.log(`[loom/api] listening on http://localhost:3001/api`);
}

void bootstrap();
