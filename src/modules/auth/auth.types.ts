export type PublicUser = {
  id: string;
  email: string;
  fullName: string | null;
  role: 'CUSTOMER' | 'ADMIN';
};

export type AuthSession = {
  token: string;
  expiresAt: Date;
  user: PublicUser;
};
