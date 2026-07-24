import { useEffect, useRef } from 'react';
import { useChatStream } from './use-chat-stream.js';
import { ChatMessage } from './chat-message.js';
import { ChatInput } from './chat-input.js';

export function ChatPage(): JSX.Element {
  const { messages, append, isLoading } = useChatStream();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (content: string): void => {
    void append({ role: 'user', content });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-sm text-ink-muted mt-16">
            Start a conversation
          </p>
        )}
        {messages.map((m) => (
          <ChatMessage key={m.id} role={m.role as 'user' | 'assistant'} content={m.content} />
        ))}
        <div ref={bottomRef} />
      </div>
      <ChatInput onSubmit={handleSubmit} isLoading={isLoading} />
    </div>
  );
}
