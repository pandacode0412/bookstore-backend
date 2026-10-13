import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type DeliveryAddress = {
  recipientName: string;
  phone: string;
  line1: string;
  ward: string | null;
  district: string | null;
  city: string;
};

@Injectable()
export class AddressesService {
  constructor(private readonly db: PrismaService) {}

  list(userId: string) {
    return this.db.address.findMany({ where: { userId }, orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }] });
  }

  async create(userId: string, body: Record<string, unknown>) {
    const address = this.validate(body);
    const requestedDefault = body.isDefault === true;
    if (body.isDefault !== undefined && typeof body.isDefault !== 'boolean') throw new BadRequestException('Invalid default address flag');
    return this.db.$transaction(async (tx) => {
      const hasAddress = await tx.address.count({ where: { userId } });
      const isDefault = requestedDefault || hasAddress === 0;
      if (isDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      return tx.address.create({ data: { userId, ...address, isDefault } });
    });
  }

  private validate(body: Record<string, unknown>): DeliveryAddress {
    return {
      recipientName: this.text(body.recipientName, 'recipient name', 1, 120),
      phone: this.phone(body.phone),
      line1: this.text(body.line1, 'address line', 3, 255),
      ward: this.optionalText(body.ward, 'ward', 120),
      district: this.optionalText(body.district, 'district', 120),
      city: this.text(body.city, 'city', 1, 120),
    };
  }

  private text(value: unknown, label: string, min: number, max: number) {
    if (typeof value !== 'string') throw new BadRequestException(`Invalid ${label}`);
    const result = value.trim();
    if (result.length < min || result.length > max) throw new BadRequestException(`Invalid ${label}`);
    return result;
  }

  private optionalText(value: unknown, label: string, max: number) {
    if (value === undefined || value === null || value === '') return null;
    return this.text(value, label, 1, max);
  }

  private phone(value: unknown) {
    const result = this.text(value, 'phone number', 8, 25);
    if (!/^[0-9+(). -]+$/.test(result)) throw new BadRequestException('Invalid phone number');
    return result;
  }
}
