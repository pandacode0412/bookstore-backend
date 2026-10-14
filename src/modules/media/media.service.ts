import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const acceptedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const uploadPurposes = new Set(['book-cover', 'book-gallery', 'banner']);
export type UploadPurpose = 'book-cover' | 'book-gallery' | 'banner';

function beginsWith(buffer: Buffer, signature: number[]) {
  return signature.every((value, index) => buffer[index] === value);
}

function detectedMimeType(buffer: Buffer): string | undefined {
  if (buffer.length >= 3 && beginsWith(buffer, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (buffer.length >= 8 && beginsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return undefined;
}

@Injectable()
export class MediaService {
  private configured = false;

  constructor() {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
    const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
    const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
    if (cloudName && apiKey && apiSecret) {
      cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
      this.configured = true;
    }
  }

  async uploadImage(file: Express.Multer.File, rawPurpose: unknown) {
    const purpose = this.validate(file, rawPurpose);
    if (!this.configured) {
      throw new ServiceUnavailableException('Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET on the API server.');
    }

    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({
        resource_type: 'image',
        folder: `bookstore/${purpose}`,
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        use_filename: false,
        unique_filename: true,
        overwrite: false,
      }, (error, response) => {
        if (error || !response) reject(error ?? new Error('Cloudinary did not return an image result'));
        else resolve(response);
      });
      stream.end(file.buffer);
    });

    return { url: result.secure_url, width: result.width, height: result.height, bytes: result.bytes, format: result.format };
  }

  private validate(file: Express.Multer.File | undefined, rawPurpose: unknown): UploadPurpose {
    if (!file || !file.buffer?.length) throw new BadRequestException('Provide one image file in the file field');
    if (file.size > MAX_IMAGE_BYTES) throw new BadRequestException('Image must be 8 MB or smaller');
    if (!acceptedMimeTypes.has(file.mimetype)) throw new BadRequestException('Only JPEG, PNG, and WebP images are supported');
    if (!uploadPurposes.has(rawPurpose as string)) throw new BadRequestException('Invalid image upload purpose');
    if (detectedMimeType(file.buffer) !== file.mimetype) throw new BadRequestException('Image content does not match its MIME type');
    return rawPurpose as UploadPurpose;
  }
}
