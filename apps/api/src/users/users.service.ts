import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { UpdateUserSchema } from '@morpheus/shared';
import { User } from './entities/user.entity.js';
import type { UpdateUser } from '@morpheus/shared';

@Injectable()
export class UsersService {
  constructor(private readonly em: EntityManager) {}

  async getOrCreate(firebaseUid: string, email: string, displayName: string | null): Promise<User> {
    const existing = await this.em.findOne(User, { firebaseUid });
    if (existing) return existing;

    const user = this.em.create(User, { firebaseUid, email, displayName });
    await this.em.flush();
    return user;
  }

  async findByFirebaseUid(firebaseUid: string): Promise<User | null> {
    return this.em.findOne(User, { firebaseUid });
  }

  async updateProfile(user: User, data: UpdateUser): Promise<User> {
    const validated = UpdateUserSchema.parse(data);
    if (validated.displayName !== undefined) {
      user.displayName = validated.displayName ?? null;
    }
    await this.em.flush();
    return user;
  }
}
