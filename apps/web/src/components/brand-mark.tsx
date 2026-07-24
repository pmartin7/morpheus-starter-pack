// Placeholder brand mark. init-project Phase 4 replaces this SVG with the product's mark. Path outlines only — no webfont-dependent <text> elements.
import { cn } from '../lib/cn.js';

export function BrandMark({ className }: { className?: string }): JSX.Element {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      fill="currentColor"
      className={cn('h-6 w-6', className)}
    >
      <path
        fillRule="evenodd"
        d="M9 3h14a6 6 0 0 1 6 6v14a6 6 0 0 1-6 6H9a6 6 0 0 1-6-6V9a6 6 0 0 1 6-6Zm0 2.5A3.5 3.5 0 0 0 5.5 9v14A3.5 3.5 0 0 0 9 26.5h14a3.5 3.5 0 0 0 3.5-3.5V9A3.5 3.5 0 0 0 23 5.5H9Z"
      />
      <circle cx="12.5" cy="19.5" r="4.5" />
    </svg>
  );
}
