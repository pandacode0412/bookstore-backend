import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000', credentials: true });
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Bookstore API')
    .setDescription('Interactive documentation for implemented Bookstore REST endpoints.')
    .setVersion('1.0.0')
    .addServer('/', 'Current server')
    .addCookieAuth('bookstore_session', { type: 'apiKey' }, 'sessionCookie')
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument, {
    jsonDocumentUrl: 'api/docs-json',
    yamlDocumentUrl: 'api/docs-yaml',
    customSiteTitle: 'Bookstore API Docs',
  });
  await app.listen(Number(process.env.PORT || 4000), '0.0.0.0');
}
bootstrap();
