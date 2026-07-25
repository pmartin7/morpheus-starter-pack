import { Injectable } from '@nestjs/common';
import { experimental_createProviderRegistry, streamText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import type { StreamTextResult, CoreTool, CoreMessage } from 'ai';

@Injectable()
export class AiService {
  private readonly registry = experimental_createProviderRegistry({
    anthropic: createAnthropic({ apiKey: process.env['ANTHROPIC_API_KEY'] }),
    openai: createOpenAI({ apiKey: process.env['OPENAI_API_KEY'] }),
  });

  async stream(messages: CoreMessage[]): Promise<StreamTextResult<Record<string, CoreTool>>> {
    const modelId = process.env['DEFAULT_AI_MODEL'] ?? 'anthropic:claude-3-5-sonnet-20241022';
    const model = this.registry.languageModel(modelId);
    return streamText({ model, messages });
  }
}
