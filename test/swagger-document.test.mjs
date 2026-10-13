import assert from 'node:assert/strict';
import test from 'node:test';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../dist/app.module.js';

test('generated Swagger document includes every implemented route', async () => {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api');
  try {
    const document = SwaggerModule.createDocument(app, new DocumentBuilder()
      .setTitle('Bookstore API')
      .addServer('/', 'Current server')
      .addCookieAuth('bookstore_session', { type: 'apiKey' }, 'sessionCookie')
      .build());
    assert.deepEqual(Object.keys(document.paths).sort(), [
      '/api/addresses',
      '/api/admin/dashboard',
      '/api/auth/login',
      '/api/auth/logout',
      '/api/auth/me',
      '/api/auth/register',
      '/api/books',
      '/api/books/{slug}',
      '/api/cart',
      '/api/cart/items',
      '/api/cart/items/{bookId}',
      '/api/categories',
      '/api/health',
      '/api/orders',
      '/api/orders/me',
      '/api/orders/{id}',
      '/api/orders/{id}/cancel',
      '/api/wishlist',
      '/api/wishlist/items',
      '/api/wishlist/items/{bookId}',
    ]);
    assert.equal(document.components.securitySchemes.sessionCookie.in, 'cookie');
    assert.equal(document.components.securitySchemes.sessionCookie.name, 'bookstore_session');
  } finally {
    await app.close();
  }
});
