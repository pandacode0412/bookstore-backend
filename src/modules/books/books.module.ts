import { Module } from '@nestjs/common';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';
import { AuthModule } from '../auth/auth.module';
import { AdminBooksController } from './admin-books.controller';
@Module({ imports: [AuthModule], controllers: [BooksController, AdminBooksController], providers: [BooksService] })
export class BooksModule {}
