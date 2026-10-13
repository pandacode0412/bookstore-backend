import { Injectable } from '@nestjs/common';
import { BookStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private readonly db: PrismaService) {}

  /** Only expose categories that currently contain a public book. */
  listPublic() {
    return this.db.category.findMany({
      where: { books: { some: { status: BookStatus.PUBLISHED } } },
      select: { id: true, name: true, slug: true },
      orderBy: { name: 'asc' },
    });
  }
}
