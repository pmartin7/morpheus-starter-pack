import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import type { SendMessage } from '@morpheus/shared';
import type { User } from '../users/entities/user.entity.js';
import { Conversation } from './entities/conversation.entity.js';
import { Message, MessageRole } from './entities/message.entity.js';
import { AiService } from '../ai/ai.service.js';
import type { StreamTextResult, CoreTool } from 'ai';

@Injectable()
export class ChatService {
  constructor(
    private readonly em: EntityManager,
    private readonly aiService: AiService,
  ) {}

  async sendMessage(
    user: User,
    data: SendMessage,
  ): Promise<StreamTextResult<Record<string, CoreTool>>> {
    let conversation: Conversation;

    if (data.conversationId) {
      const found = await this.em.findOne(Conversation, {
        id: data.conversationId,
        user,
      });
      if (!found) throw new NotFoundException('Conversation not found');
      conversation = found;
    } else {
      conversation = this.em.create(Conversation, {
        user,
        title: data.content.slice(0, 60) || null,
      });
      await this.em.flush();
    }

    this.em.create(Message, {
      conversation,
      role: MessageRole.USER,
      content: data.content,
    });
    await this.em.flush();

    const history = await this.em.find(
      Message,
      { conversation },
      { orderBy: { createdAt: 'asc' } },
    );
    const messages = history.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const stream = await this.aiService.stream(messages);

    stream.text
      .then(async (assistantText: string) => {
        this.em.create(Message, {
          conversation,
          role: MessageRole.ASSISTANT,
          content: assistantText,
        });
        await this.em.flush();
      })
      .catch(() => {});

    return stream;
  }

  async getConversations(user: User): Promise<Conversation[]> {
    return this.em.find(Conversation, { user }, { orderBy: { updatedAt: 'desc' } });
  }

  async getConversation(user: User, id: string): Promise<Conversation> {
    const conversation = await this.em.findOne(
      Conversation,
      { id, user },
      { populate: ['messages'] },
    );
    if (!conversation) throw new NotFoundException('Conversation not found');
    return conversation;
  }
}
