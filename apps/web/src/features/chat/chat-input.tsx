import { useRef } from 'react';
import { Button } from '../../components/ui/button.js';

interface ChatInputProps {
  onSubmit: (content: string) => void;
  isLoading: boolean;
}

export function ChatInput({ onSubmit, isLoading }: ChatInputProps): JSX.Element {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (): void => {
    const content = textareaRef.current?.value.trim();
    if (!content || isLoading) return;
    onSubmit(content);
    if (textareaRef.current) textareaRef.current.value = '';
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex gap-2 items-end border-t border-border bg-card px-4 py-3">
      <textarea
        ref={textareaRef}
        onKeyDown={handleKeyDown}
        disabled={isLoading}
        placeholder="Type a message…"
        rows={1}
        className="flex-1 resize-none rounded-xl border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
      />
      <Button
        onClick={handleSubmit}
        disabled={isLoading}
        size="sm"
        aria-label="Send message"
      >
        {isLoading ? '…' : 'Send'}
      </Button>
    </div>
  );
}
