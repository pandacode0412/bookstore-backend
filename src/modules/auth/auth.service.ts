import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { compare, hash } from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthSession, PublicUser } from './auth.types';
import { readCookie } from './csrf';

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const publicUserSelect = { id: true, email: true, fullName: true, role: true } as const;

type RegisterInput = { email?: unknown; password?: unknown; fullName?: unknown };
type LoginInput = { email?: unknown; password?: unknown };

@Injectable()
export class AuthService {
  constructor(private readonly db: PrismaService) {}

  async register(input: RegisterInput): Promise<AuthSession> {
    const email = this.email(input.email);
    const password = this.password(input.password);
    const fullName = this.fullName(input.fullName);
    try {
      const user = await this.db.user.create({
        data: { email, passwordHash: await hash(password, 12), fullName },
        select: publicUserSelect,
      });
      return this.issueSession(user);
    } catch (error: unknown) {
      if (this.isUniqueEmailError(error)) throw new ConflictException('Email already registered');
      throw error;
    }
  }

  async login(input: LoginInput): Promise<AuthSession> {
    const email = this.email(input.email);
    if (typeof input.password !== 'string' || input.password.length === 0 || input.password.length > 128) {
      throw new BadRequestException('Invalid login payload');
    }
    const user = await this.db.user.findUnique({
      where: { email },
      select: { ...publicUserSelect, passwordHash: true },
    });
    if (!user || !(await compare(input.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const { passwordHash: _passwordHash, ...publicUser } = user;
    return this.issueSession(publicUser);
  }

  private async issueSession(user: PublicUser): Promise<AuthSession> {
    const token = randomBytes(32).toString('base64url');
    const tokenHash = this.tokenHash(token);
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
    await this.db.$transaction(async (tx) => {
      await tx.session.deleteMany({ where: { userId: user.id } });
      await tx.session.create({ data: { userId: user.id, tokenHash, expiresAt } });
    });
    return { token, expiresAt, user };
  }

  async me(cookieHeader?: string): Promise<PublicUser> {
    const token = this.sessionToken(cookieHeader);
    const session = await this.db.session.findUnique({
      where: { tokenHash: this.tokenHash(token) },
      select: { id: true, expiresAt: true, user: { select: publicUserSelect } },
    });
    if (!session || session.expiresAt <= new Date()) {
      if (session) await this.db.session.delete({ where: { id: session.id } });
      throw new UnauthorizedException('Session expired or invalid');
    }
    return session.user;
  }

  async logout(cookieHeader?: string): Promise<void> {
    const token = this.sessionToken(cookieHeader);
    const result = await this.db.session.deleteMany({ where: { tokenHash: this.tokenHash(token) } });
    if (result.count === 0) throw new UnauthorizedException('Session expired or invalid');
  }

  private email(value: unknown) {
    if (typeof value !== 'string') throw new BadRequestException('Invalid email');
    const email = value.trim().toLowerCase();
    if (email.length > 254 || !EMAIL_PATTERN.test(email)) throw new BadRequestException('Invalid email');
    return email;
  }

  private password(value: unknown) {
    if (typeof value !== 'string' || value.length < 6 || value.length > 128) {
      throw new BadRequestException('Password must be between 6 and 128 characters');
    }
    return value;
  }

  private fullName(value: unknown) {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'string') throw new BadRequestException('Invalid full name');
    const fullName = value.trim();
    if (fullName.length < 1 || fullName.length > 120) throw new BadRequestException('Invalid full name');
    return fullName;
  }

  private sessionToken(cookieHeader?: string) {
    const token = readCookie(cookieHeader, 'bookstore_session');
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new UnauthorizedException('Session required');
    return token;
  }

  private tokenHash(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private isUniqueEmailError(error: unknown) {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }
}
