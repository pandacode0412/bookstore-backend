import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const categorySelect = { id: true, name: true, slug: true } as const;
const adminCategorySelect = { ...categorySelect, description: true, isActive: true, sortOrder: true } as const;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_SORT_ORDER = 1_000_000;
type CategoryInput = { name?: unknown; slug?: unknown; description?: unknown; isActive?: unknown; sortOrder?: unknown };

@Injectable()
export class CategoriesService {
  constructor(private readonly db: PrismaService) {}

  /** Storefront navigation must expose real active taxonomy, even before a category has a published book. */
  listPublic() {
    return this.db.category.findMany({
      where: { isActive: true },
      select: categorySelect,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  listAdmin() {
    return this.db.category.findMany({
      select: adminCategorySelect,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async create(input: CategoryInput) {
    this.assertFields(input, ['name', 'slug', 'description', 'isActive', 'sortOrder']);
    const name = this.name(input.name, true);
    const slug = this.slug(input.slug, true);
    const description = this.description(input.description, true);
    const isActive = this.isActive(input.isActive, true);
    const sortOrder = this.sortOrder(input.sortOrder, true);
    if (name === undefined || slug === undefined || isActive === undefined || sortOrder === undefined) {
      throw new BadRequestException('Invalid category payload');
    }
    try {
      return await this.db.category.create({ data: { name, slug, description, isActive, sortOrder }, select: adminCategorySelect });
    } catch (error: unknown) {
      if (this.isUniqueError(error)) throw new ConflictException('Category slug already exists');
      throw error;
    }
  }

  async update(id: string, input: CategoryInput) {
    if (!UUID_PATTERN.test(id)) throw new BadRequestException('Invalid category id');
    this.assertFields(input, ['name', 'slug', 'description', 'isActive', 'sortOrder']);
    const fields = Object.keys(input);
    if (fields.length === 0) throw new BadRequestException('Provide at least one category field');
    const data = {
      ...(Object.hasOwn(input, 'name') ? { name: this.name(input.name, false) } : {}),
      ...(Object.hasOwn(input, 'slug') ? { slug: this.slug(input.slug, false) } : {}),
      ...(Object.hasOwn(input, 'description') ? { description: this.description(input.description, false) } : {}),
      ...(Object.hasOwn(input, 'isActive') ? { isActive: this.isActive(input.isActive, false) } : {}),
      ...(Object.hasOwn(input, 'sortOrder') ? { sortOrder: this.sortOrder(input.sortOrder, false) } : {}),
    };
    try {
      return await this.db.category.update({ where: { id }, data, select: adminCategorySelect });
    } catch (error: unknown) {
      if (this.isUniqueError(error)) throw new ConflictException('Category slug already exists');
      if (this.isMissingError(error)) throw new NotFoundException('Category not found');
      throw error;
    }
  }

  private assertFields(input: CategoryInput, fields: string[]) {
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !fields.includes(key))) {
      throw new BadRequestException('Invalid category payload');
    }
  }

  private name(value: unknown, required: boolean) {
    if (value === undefined && !required) return undefined;
    if (typeof value !== 'string') throw new BadRequestException('Invalid category name');
    const name = value.trim().replace(/\s+/g, ' ');
    if (name.length < 1 || name.length > 100) throw new BadRequestException('Invalid category name');
    return name;
  }

  private slug(value: unknown, required: boolean) {
    if (value === undefined && !required) return undefined;
    if (typeof value !== 'string') throw new BadRequestException('Invalid category slug');
    const slug = value.trim();
    if (slug.length > 100 || !SLUG_PATTERN.test(slug)) throw new BadRequestException('Invalid category slug');
    return slug;
  }

  private description(value: unknown, required: boolean) {
    if (value === undefined && !required) return undefined;
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'string') throw new BadRequestException('Invalid category description');
    const description = value.trim();
    if (description.length > 500) throw new BadRequestException('Invalid category description');
    return description;
  }

  private isActive(value: unknown, required: boolean) {
    if (value === undefined && !required) return undefined;
    if (value === undefined && required) return true;
    if (typeof value !== 'boolean') throw new BadRequestException('Invalid category active state');
    return value;
  }

  private sortOrder(value: unknown, required: boolean) {
    if (value === undefined && !required) return undefined;
    if (value === undefined && required) return 0;
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > MAX_SORT_ORDER) {
      throw new BadRequestException('Invalid category sort order');
    }
    return value;
  }

  private isUniqueError(error: unknown) { return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'; }
  private isMissingError(error: unknown) { return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025'; }
}
