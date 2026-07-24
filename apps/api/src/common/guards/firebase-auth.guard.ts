import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  OnModuleInit,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { Request } from 'express';
import * as admin from 'firebase-admin';
import { UsersService } from '../../users/users.service.js';

@Injectable()
export class FirebaseAuthGuard implements CanActivate, OnModuleInit {
  private usersService!: UsersService;

  constructor(private readonly moduleRef: ModuleRef) {}

  onModuleInit(): void {
    this.usersService = this.moduleRef.get(UsersService, { strict: false });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: unknown }>();
    const authHeader = request.headers['authorization'];

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.slice(7);

    let decoded: admin.auth.DecodedIdToken;
    try {
      decoded = await admin.auth().verifyIdToken(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired Firebase token');
    }

    // Password-provider accounts must verify their email before touching the
    // API: getOrCreate below claims the email column (unique), so an unverified
    // signup could squat another person's address. Google tokens always arrive
    // verified.
    if (decoded.firebase.sign_in_provider === 'password' && !decoded.email_verified) {
      throw new UnauthorizedException('Email not verified');
    }

    const user = await this.usersService.getOrCreate(
      decoded.uid,
      decoded['email'] ?? '',
      decoded['name'] ?? null,
    );

    request.user = user;
    return true;
  }
}
