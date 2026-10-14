import assert from 'node:assert/strict';
import test from 'node:test';
import { MediaService } from '../dist/modules/media/media.service.js';

const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

test('media upload rejects a declared MIME type that does not match file bytes before contacting Cloudinary', async () => {
  const service = new MediaService();
  await assert.rejects(
    () => service.uploadImage({ buffer: pngSignature, size: pngSignature.length, mimetype: 'image/jpeg' }, 'book-cover'),
    /Image content does not match its MIME type/,
  );
});

test('media upload rejects purposes outside the storefront media folders', async () => {
  const service = new MediaService();
  await assert.rejects(
    () => service.uploadImage({ buffer: pngSignature, size: pngSignature.length, mimetype: 'image/png' }, 'anything-else'),
    /Invalid image upload purpose/,
  );
});
