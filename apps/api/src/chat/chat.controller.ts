import { Body, Controller, Get, Param, Post, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { SendMessageSchema } from '@morpheus/shared';
import type { SendMessage } from '@morpheus/shared';
import { FirebaseAuthGuard } from '../common/guards/firebase-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import type { User } from '../users/entities/user.entity.js';
import { ChatService } from './chat.service.js';
import type { Conversation } from './entities/conversation.entity.js';

@Controller('chat')
@UseGuards(FirebaseAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // Stricter than the global limit: each send triggers a paid AI completion.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('send')
  async send(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(SendMessageSchema)) body: SendMessage,
    @Res() res: Response,
  ): Promise<void> {
    const stream = await this.chatService.sendMessage(user, body);
    stream.pipeDataStreamToResponse(res);
  }

  @Get('conversations')
  getConversations(@CurrentUser() user: User): Promise<Conversation[]> {
    return this.chatService.getConversations(user);
  }

  @Get('conversations/:id')
  getConversation(@CurrentUser() user: User, @Param('id') id: string): Promise<Conversation> {
    return this.chatService.getConversation(user, id);
  }
}
