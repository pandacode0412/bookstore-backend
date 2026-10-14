import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { AdminOrdersController } from './admin-orders.controller';

@Module({ imports: [AuthModule], controllers: [OrdersController, AdminOrdersController], providers: [OrdersService] })
export class OrdersModule {}
