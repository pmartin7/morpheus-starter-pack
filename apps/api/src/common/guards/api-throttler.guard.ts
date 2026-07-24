import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { createHash } from 'node:crypto';
import type { Request } from 'express';

@Injectable()
export class ApiThrottlerGuard extends ThrottlerGuard {
  // Track authenticated requests per bearer token so users behind a shared IP
  // (NAT, corporate proxy) don't exhaust each other's quota. Anonymous
  // requests fall back to IP.
  protected override async getTracker(req: Request): Promise<string> {
    const authHeader = req.headers['authorization'];
    if (authHeader?.startsWith('Bearer ')) {
      return createHash('sha256').update(authHeader).digest('hex');
    }
    return req.ip ?? 'unknown';
  }
}
