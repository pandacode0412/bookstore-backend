import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BookStatus, OrderStatus, PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const orderInclude = { items: { orderBy: { id: 'asc' as const } }, payments: { select: { status: true } } } as const;
type OrderWithItems = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

@Injectable()
export class OrdersService {
  constructor(private readonly db: PrismaService) {}

  async checkout(userId: string, rawKey: unknown, body: Record<string, unknown>) {
    const idempotencyKey = this.idempotencyKey(rawKey);
    const input = this.checkoutInput(body);
    const requestHash = createHash('sha256').update(JSON.stringify(input)).digest('hex');
    try {
      return await this.db.$transaction(async (tx) => {
        const duplicate = await tx.order.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey } }, include: orderInclude });
        if (duplicate) return this.sameRequest(duplicate, requestHash);

        const [address, cart] = await Promise.all([
          tx.address.findFirst({ where: { id: input.addressId, userId } }),
          tx.cart.findUnique({ where: { userId }, include: { items: { include: { book: true }, orderBy: { createdAt: 'asc' } } } }),
        ]);
        if (!address) throw new NotFoundException('Delivery address not found');
        if (!cart?.items.length) throw new BadRequestException('Cart is empty');

        for (const item of cart.items) {
          if (item.quantity < 1 || item.quantity > 99 || item.book.status !== BookStatus.PUBLISHED) throw new ConflictException('Cart contains an unavailable book');
          const decremented = await tx.book.updateMany({ where: { id: item.bookId, status: BookStatus.PUBLISHED, stock: { gte: item.quantity } }, data: { stock: { decrement: item.quantity } } });
          if (decremented.count !== 1) throw new ConflictException('A book in your cart no longer has enough stock');
        }

        const subtotalVnd = cart.items.reduce((total, item) => total + (item.book.salePriceVnd ?? item.book.priceVnd) * item.quantity, 0);
        const orderId = randomUUID();
        const order = await tx.order.create({
          data: {
            id: orderId,
            orderCode: this.orderCode(),
            userId,
            idempotencyKey,
            requestHash,
            paymentMethod: PaymentMethod.COD,
            subtotalVnd,
            shippingFeeVnd: 0,
            totalVnd: subtotalVnd,
            addressSnapshot: { recipientName: address.recipientName, phone: address.phone, line1: address.line1, ward: address.ward, district: address.district, city: address.city },
            note: input.note,
            items: { create: cart.items.map((item) => {
              const unitPriceVnd = item.book.salePriceVnd ?? item.book.priceVnd;
              return { bookId: item.bookId, skuSnapshot: item.book.sku, titleSnapshot: item.book.title, unitPriceVnd, quantity: item.quantity, lineTotalVnd: unitPriceVnd * item.quantity };
            }) },
            payments: { create: { method: PaymentMethod.COD, status: PaymentStatus.UNPAID, amountVnd: subtotalVnd } },
            inventoryMovements: { create: cart.items.map((item) => ({ bookId: item.bookId, delta: -item.quantity, reason: 'ORDER_PLACED', sourceKey: `order:${orderId}:create:${item.bookId}` })) },
          },
          include: orderInclude,
        });
        await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
        return this.present(order);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error: unknown) {
      if (!this.isUniqueError(error)) throw error;
      const duplicate = await this.db.order.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey } }, include: orderInclude });
      if (!duplicate) throw error;
      return this.sameRequest(duplicate, requestHash);
    }
  }

  async list(userId: string) {
    const orders = await this.db.order.findMany({ where: { userId }, include: orderInclude, orderBy: { createdAt: 'desc' } });
    return orders.map((order) => this.present(order));
  }

  async get(userId: string, rawId: unknown) {
    const id = this.orderId(rawId);
    const order = await this.db.order.findFirst({ where: { id, userId }, include: orderInclude });
    if (!order) throw new NotFoundException('Order not found');
    return this.present(order);
  }

  async cancel(userId: string, rawId: unknown) {
    const id = this.orderId(rawId);
    return this.db.$transaction(async (tx) => {
      const order = await tx.order.findFirst({ where: { id, userId }, include: orderInclude });
      if (!order) throw new NotFoundException('Order not found');
      if (order.status === OrderStatus.CANCELED) return this.present(order);
      if (order.status !== OrderStatus.PENDING) throw new ConflictException('Only pending orders can be cancelled');
      const cancelled = await tx.order.updateMany({ where: { id, userId, status: OrderStatus.PENDING }, data: { status: OrderStatus.CANCELED } });
      if (cancelled.count !== 1) throw new ConflictException('Order status changed; reload and try again');
      for (const item of order.items) {
        await tx.book.update({ where: { id: item.bookId }, data: { stock: { increment: item.quantity } } });
        await tx.inventoryMovement.create({ data: { bookId: item.bookId, orderId: id, delta: item.quantity, reason: 'ORDER_CANCELED', sourceKey: `order:${id}:cancel:${item.bookId}` } });
      }
      return this.present({ ...order, status: OrderStatus.CANCELED });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private checkoutInput(body: Record<string, unknown>) {
    const addressId = this.orderId(body.addressId, 'Invalid delivery address id');
    if (body.paymentMethod !== 'COD') throw new BadRequestException('Only COD is available');
    if (body.note !== undefined && (typeof body.note !== 'string' || body.note.trim().length > 500)) throw new BadRequestException('Invalid order note');
    return { addressId, paymentMethod: 'COD', note: typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null };
  }

  private idempotencyKey(value: unknown) { return this.orderId(value, 'Invalid Idempotency-Key'); }
  private orderId(value: unknown, message = 'Invalid order id') {
    if (typeof value !== 'string' || !UUID_PATTERN.test(value)) throw new BadRequestException(message);
    return value;
  }

  private orderCode() { return `BS-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().slice(0, 8).toUpperCase()}`; }
  private sameRequest(order: OrderWithItems, requestHash: string) {
    if (order.requestHash !== requestHash) throw new ConflictException('Idempotency-Key was already used with another request');
    return this.present(order);
  }
  private present(order: OrderWithItems) {
    return { id: order.id, orderCode: order.orderCode, status: order.status, paymentMethod: order.paymentMethod, paymentStatus: order.payments[0]?.status ?? PaymentStatus.UNPAID, subtotalVnd: order.subtotalVnd, shippingFeeVnd: order.shippingFeeVnd, totalVnd: order.totalVnd, addressSnapshot: order.addressSnapshot, note: order.note, createdAt: order.createdAt, items: order.items.map(({ bookId, skuSnapshot, titleSnapshot, unitPriceVnd, quantity, lineTotalVnd }) => ({ bookId, skuSnapshot, titleSnapshot, unitPriceVnd, quantity, lineTotalVnd })) };
  }
  private isUniqueError(error: unknown) { return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'; }
}
