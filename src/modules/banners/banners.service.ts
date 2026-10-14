import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const publicBannerSelect = { id: true, title: true, altText: true, imageUrl: true, href: true, objectPosition: true } as const;
const adminBannerSelect = { ...publicBannerSelect, isActive: true, sortOrder: true, createdAt: true, updatedAt: true } as const;
type BannerInput = Record<string, unknown>;

@Injectable()
export class BannersService {
  constructor(private readonly db: PrismaService) {}

  listPublic() { return this.db.banner.findMany({ where: { isActive: true }, select: publicBannerSelect, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }); }
  listAdmin() { return this.db.banner.findMany({ select: adminBannerSelect, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }); }

  async create(input: BannerInput) {
    const data = this.input(input, true);
    return this.db.banner.create({ data: data as never, select: adminBannerSelect });
  }
  async update(id: string, input: BannerInput) {
    if (!UUID_PATTERN.test(id)) throw new BadRequestException('Invalid banner id');
    if (Object.keys(input).length === 0) throw new BadRequestException('Provide at least one banner field');
    const data = this.input(input, false);
    try { return await this.db.banner.update({ where: { id }, data: data as never, select: adminBannerSelect }); }
    catch (error: unknown) { if (this.isMissing(error)) throw new NotFoundException('Banner not found'); throw error; }
  }

  private input(input: BannerInput, creating: boolean) {
    const fields = ['title', 'altText', 'imageUrl', 'href', 'objectPosition', 'isActive', 'sortOrder'];
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !fields.includes(key))) throw new BadRequestException('Invalid banner payload');
    const required = (field: string) => creating && !Object.hasOwn(input, field);
    for (const field of ['title', 'altText', 'imageUrl']) if (required(field)) throw new BadRequestException(`Missing ${field}`);
    const text = (value: unknown, field: string, max: number, fallback?: string) => {
      if (value === undefined && !creating) return undefined;
      if (value === undefined && fallback !== undefined) return fallback;
      if (typeof value !== 'string') throw new BadRequestException(`Invalid banner ${field}`);
      const normalized = value.trim();
      if (normalized.length < 1 || normalized.length > max) throw new BadRequestException(`Invalid banner ${field}`);
      return normalized;
    };
    const imageUrl = text(input.imageUrl, 'image URL', 2048);
    if (imageUrl !== undefined && !/^(https:\/\/|\/)/.test(imageUrl)) throw new BadRequestException('Banner image URL must use HTTPS or a local path');
    const href = text(input.href, 'destination', 2048, '/books');
    if (href !== undefined && !href.startsWith('/')) throw new BadRequestException('Banner destination must be a local storefront path');
    const objectPosition = text(input.objectPosition, 'image position', 80, 'center center');
    const isActive = input.isActive === undefined && !creating ? undefined : input.isActive === undefined ? true : typeof input.isActive === 'boolean' ? input.isActive : (() => { throw new BadRequestException('Invalid banner active state'); })();
    const sortOrder = input.sortOrder === undefined && !creating ? undefined : input.sortOrder === undefined ? 0 : typeof input.sortOrder === 'number' && Number.isInteger(input.sortOrder) && input.sortOrder >= 0 && input.sortOrder <= 1_000_000 ? input.sortOrder : (() => { throw new BadRequestException('Invalid banner sort order'); })();
    return { title: text(input.title, 'title', 140), altText: text(input.altText, 'alt text', 200), imageUrl, href, objectPosition, isActive, sortOrder };
  }
  private isMissing(error: unknown) { return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025'; }
}
