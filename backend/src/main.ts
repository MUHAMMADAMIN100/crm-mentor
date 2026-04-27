import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const corsEnv = process.env.CORS_ORIGIN || '*';
  app.enableCors({
    origin: corsEnv === '*' ? true : corsEnv.split(','),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );
  app.setGlobalPrefix('api');
  const port = parseInt(process.env.PORT || '3000', 10);
  await app.listen(port, '0.0.0.0');
  console.log(`Miz backend listening on :${port}`);
}
bootstrap();
