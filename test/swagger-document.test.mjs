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
      '/api/admin/banners',
      '/api/admin/banners/{id}',
      '/api/admin/books',
      '/api/admin/books/summary',
      '/api/admin/books/{id}',
      '/api/admin/categories',
      '/api/admin/categories/{id}',
      '/api/admin/customers',
      '/api/admin/dashboard',
      '/api/admin/media/images',
      '/api/admin/orders',
      '/api/admin/orders/{id}/status',
      '/api/auth/login',
      '/api/auth/logout',
      '/api/auth/me',
      '/api/auth/register',
      '/api/banners',
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
    const bookParameters = document.paths['/api/books'].get.parameters;
    assert.deepEqual(bookParameters.find((parameter) => parameter.name === 'sort').schema.enum, ['newest', 'price_asc', 'price_desc', 'bestselling']);
    assert.deepEqual(bookParameters.find((parameter) => parameter.name === 'onSale').schema.enum, ['true']);
    assert.ok(document.paths['/api/admin/categories'].get);
    assert.ok(document.paths['/api/admin/categories'].post);
    assert.ok(document.paths['/api/admin/categories/{id}'].patch);
    assert.ok(document.paths['/api/admin/books'].get);
    assert.ok(document.paths['/api/admin/books'].post);
    assert.ok(document.paths['/api/admin/books/{id}'].get);
    assert.ok(document.paths['/api/admin/books/{id}'].patch);
    assert.ok(document.paths['/api/admin/books/summary'].get);
    assert.ok(document.paths['/api/admin/orders/{id}/status'].patch);
    assert.ok(document.paths['/api/admin/banners'].post);
    assert.ok(document.paths['/api/admin/media/images'].post);
    assert.ok(document.paths['/api/admin/media/images'].post.requestBody.content['multipart/form-data']);
  } finally {
    await app.close();
  }
});
