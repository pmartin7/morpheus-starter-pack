import { UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FirebaseAuthGuard } from './firebase-auth.guard.js';
import type { ExecutionContext } from '@nestjs/common';
import type { ModuleRef } from '@nestjs/core';

// The Admin SDK is the boundary (docs/TESTING.md §6): what is under test is what
// the guard does with a decoded token, never how a signature is verified.
const { verifyIdToken } = vi.hoisted(() => ({ verifyIdToken: vi.fn() }));

vi.mock('firebase-admin', () => ({
  auth: () => ({ verifyIdToken }),
}));

function decodedToken(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    uid: 'firebase-uid-1',
    email: 'ada@example.com',
    email_verified: true,
    name: 'Ada Lovelace',
    firebase: { sign_in_provider: 'password' },
    ...overrides,
  };
}

interface HttpCall {
  request: { headers: Record<string, string>; user?: unknown };
  context: ExecutionContext;
}

// A two-method stand-in beats a mock of the whole ExecutionContext: the guard
// only ever reaches for the request's headers.
function httpCall(headers: Record<string, string>): HttpCall {
  const request: HttpCall['request'] = { headers };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { request, context };
}

describe('FirebaseAuthGuard', () => {
  const persistedUser = { id: 'user-1', firebaseUid: 'firebase-uid-1' };
  const usersService = { getOrCreate: vi.fn() };
  let guard: FirebaseAuthGuard;

  beforeEach(() => {
    vi.clearAllMocks();
    usersService.getOrCreate.mockResolvedValue(persistedUser);
    // The guard resolves UsersService in onModuleInit, so constructing it is not
    // enough — without the lifecycle call canActivate hits an undefined service.
    const moduleRef = { get: vi.fn().mockReturnValue(usersService) } as unknown as ModuleRef;
    guard = new FirebaseAuthGuard(moduleRef);
    guard.onModuleInit();
  });

  it('admits a verified password account and forwards its identity to UsersService', async () => {
    verifyIdToken.mockResolvedValue(decodedToken());
    const { context } = httpCall({ authorization: 'Bearer id-token-1' });

    const admitted = await guard.canActivate(context);

    expect(admitted).toBe(true);
    expect(verifyIdToken).toHaveBeenCalledWith('id-token-1');
    expect(usersService.getOrCreate).toHaveBeenCalledWith(
      'firebase-uid-1',
      'ada@example.com',
      'Ada Lovelace',
    );
  });

  it('attaches the persisted user to the request', async () => {
    verifyIdToken.mockResolvedValue(decodedToken());
    const { context, request } = httpCall({ authorization: 'Bearer id-token-1' });

    await guard.canActivate(context);

    expect(request.user).toBe(persistedUser);
  });

  it('passes a null display name when the token carries no name claim', async () => {
    verifyIdToken.mockResolvedValue(decodedToken({ name: undefined }));
    const { context } = httpCall({ authorization: 'Bearer id-token-1' });

    await guard.canActivate(context);

    expect(usersService.getOrCreate).toHaveBeenCalledWith(
      'firebase-uid-1',
      'ada@example.com',
      null,
    );
  });

  it('rejects a token that carries no email claim', async () => {
    verifyIdToken.mockResolvedValue(decodedToken({ email: undefined }));
    const { context } = httpCall({ authorization: 'Bearer id-token-1' });

    const rejection = guard.canActivate(context);

    await expect(rejection).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(rejection).rejects.toThrow('Token has no email claim');
    // User.email is unique and not nullable: persisting an empty string would
    // make the second such token a 500 instead of a 401.
    expect(usersService.getOrCreate).not.toHaveBeenCalled();
  });

  it('rejects a password account whose email is not verified', async () => {
    verifyIdToken.mockResolvedValue(decodedToken({ email_verified: false }));
    const { context } = httpCall({ authorization: 'Bearer id-token-1' });

    const rejection = guard.canActivate(context);

    await expect(rejection).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(rejection).rejects.toThrow('Email not verified');
    // getOrCreate claims the email column, so an unverified signup must never
    // reach it — that is how an address gets squatted.
    expect(usersService.getOrCreate).not.toHaveBeenCalled();
  });

  it('admits a Google account whose email claim is not verified', async () => {
    verifyIdToken.mockResolvedValue(
      decodedToken({ email_verified: false, firebase: { sign_in_provider: 'google.com' } }),
    );
    const { context } = httpCall({ authorization: 'Bearer id-token-1' });

    const admitted = await guard.canActivate(context);

    // Deliberate asymmetry: Google owns the mailbox check, so only password
    // accounts have anything left to prove here.
    expect(admitted).toBe(true);
  });

  it('rejects a request with no Authorization header before verifying anything', async () => {
    const { context } = httpCall({});

    const rejection = guard.canActivate(context);

    await expect(rejection).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(rejection).rejects.toThrow('Missing or invalid Authorization header');
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it('rejects an Authorization header that is not a Bearer token', async () => {
    const { context } = httpCall({ authorization: 'Basic YWRhOnNlY3JldA==' });

    const rejection = guard.canActivate(context);

    await expect(rejection).rejects.toBeInstanceOf(UnauthorizedException);
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it('rejects a token the Admin SDK refuses to verify', async () => {
    verifyIdToken.mockRejectedValue(new Error('Firebase ID token has expired'));
    const { context } = httpCall({ authorization: 'Bearer expired-token' });

    const rejection = guard.canActivate(context);

    await expect(rejection).rejects.toBeInstanceOf(UnauthorizedException);
    // The SDK's own message never reaches the client.
    await expect(rejection).rejects.toThrow('Invalid or expired Firebase token');
  });
});
