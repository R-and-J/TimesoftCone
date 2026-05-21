import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import { AppModule } from "./app.module";
import { BigIntInterceptor } from "./interfaces/http/json-bigint.interceptor";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalInterceptors(new BigIntInterceptor());
  app.enableCors({ origin: true, credentials: true });
  // Required so SettleDueAuctionsScheduler#onApplicationShutdown clears its
  // interval when SIGINT/SIGTERM arrives, instead of leaking handles.
  app.enableShutdownHooks();
  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  new Logger("Bootstrap").log(`TimesoftCone API listening on :${port}`);
}

bootstrap();
