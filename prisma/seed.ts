import { PrismaClient, BookStatus, Role } from '@prisma/client';
import { hash } from 'bcryptjs';
const prisma = new PrismaClient();

async function main() {
  const cat = await prisma.category.upsert({
    where: { slug: 'cong-nghe' },
    update: { name: 'Công nghệ' },
    create: { slug: 'cong-nghe', name: 'Công nghệ' },
  });
  const cat2 = await prisma.category.upsert({
    where: { slug: 'phat-trien-ban-than' },
    update: { name: 'Phát triển bản thân' },
    create: { slug: 'phat-trien-ban-than', name: 'Phát triển bản thân' },
  });
  const books = [
    {sku:'BK-001',slug:'clean-code',title:'Clean Code',priceVnd:220000,salePriceVnd:199000,stock:15,categoryId:cat.id},
    {sku:'BK-002',slug:'atomic-habits',title:'Atomic Habits',priceVnd:180000,salePriceVnd:165000,stock:20,categoryId:cat2.id},
    {sku:'BK-003',slug:'the-pragmatic-programmer',title:'The Pragmatic Programmer',priceVnd:290000,salePriceVnd:null,stock:8,categoryId:cat.id},
  ];
  for (const book of books) {
    await prisma.book.upsert({
      where: { sku: book.sku },
      update: { ...book, status: BookStatus.PUBLISHED },
      create: { ...book, status: BookStatus.PUBLISHED },
    });
  }
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    if (adminPassword.length < 6 || adminPassword.length > 128) throw new Error('SEED_ADMIN_PASSWORD must be 6 to 128 characters');
    await prisma.user.upsert({
      where: { email: adminEmail },
      update: { fullName: 'Quản trị viên', role: Role.ADMIN, passwordHash: await hash(adminPassword, 12) },
      create: { email: adminEmail, fullName: 'Quản trị viên', role: Role.ADMIN, passwordHash: await hash(adminPassword, 12) },
    });
    console.log(`Development admin ensured: ${adminEmail}`);
  }
  console.log('Demo seed complete: 2 categories, 3 books (idempotent).');
}
main().catch(e => { console.error(e); process.exitCode = 1; })
  .finally(async () => prisma.$disconnect());
