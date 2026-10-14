import { Body, Controller, HttpCode, HttpStatus, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBadRequestResponse, ApiBody, ApiConsumes, ApiCookieAuth, ApiForbiddenResponse, ApiHeader, ApiOperation, ApiResponse, ApiServiceUnavailableResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { AdminMediaGuard } from './admin-media.guard';
import { MAX_IMAGE_BYTES, MediaService } from './media.service';

@ApiTags('Admin media')
@ApiCookieAuth('sessionCookie')
@Controller('admin/media')
@UseGuards(AdminMediaGuard)
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @ApiOperation({ summary: 'Upload a book or banner image to Cloudinary as ADMIN' })
  @ApiConsumes('multipart/form-data')
  @ApiHeader({ name: 'X-CSRF-Token', required: true })
  @ApiBody({ schema: {
    type: 'object', required: ['file', 'purpose'], properties: {
      file: { type: 'string', format: 'binary', description: 'JPEG, PNG, or WebP image up to 8 MB' },
      purpose: { type: 'string', enum: ['book-cover', 'book-gallery', 'banner'] },
    },
  } })
  @ApiResponse({ status: 201, description: 'Cloudinary-hosted image metadata', schema: { type: 'object', required: ['url', 'width', 'height', 'bytes', 'format'], properties: {
    url: { type: 'string', format: 'uri' }, width: { type: 'integer' }, height: { type: 'integer' }, bytes: { type: 'integer' }, format: { type: 'string' },
  } } })
  @ApiUnauthorizedResponse({ description: 'Session and CSRF token required' })
  @ApiForbiddenResponse({ description: 'ADMIN role required or cross-site request rejected' })
  @ApiBadRequestResponse({ description: 'Invalid purpose, MIME type, image content, or file size' })
  @ApiServiceUnavailableResponse({ description: 'Cloudinary credentials are not configured on the API server' })
  @Post('images')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES, files: 1 } }))
  @HttpCode(HttpStatus.CREATED)
  upload(@UploadedFile() file: Express.Multer.File | undefined, @Body('purpose') purpose: unknown) {
    return this.media.uploadImage(file as Express.Multer.File, purpose);
  }
}
