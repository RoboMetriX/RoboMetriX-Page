import type { KeyboardEvent } from 'react';

export function handleTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
  if (event.defaultPrevented || event.nativeEvent.isComposing ||
    event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
  const index = tabs.findIndex((tab) => tab === event.target);
  if (index === -1) return;

  let next: number;
  switch (event.key) {
    case 'ArrowLeft':
      next = (index + tabs.length - 1) % tabs.length;
      break;
    case 'ArrowRight':
      next = (index + 1) % tabs.length;
      break;
    case 'Home':
      next = 0;
      break;
    case 'End':
      next = tabs.length - 1;
      break;
    default:
      return;
  }
  event.preventDefault();
  tabs[next].focus();
  tabs[next].click();
}
