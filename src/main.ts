import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import dns from 'dns';

dns.setDefaultResultOrder('ipv4first');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim())
    : [
        'http://localhost:3000',
        'http://localhost:5173',
        'http://localhost:4173',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:5173',
      ];
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`Application is running on: http://localhost:${port}`);
}
bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
//тестовый комментарий
