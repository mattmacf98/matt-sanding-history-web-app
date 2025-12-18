import { useState } from 'react';

/**
 * Custom hook for copying text to clipboard with feedback
 * @returns Object with copied state and copyToClipboard function
 */
export const useClipboardCopy = () => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  return { copied, copyToClipboard };
};

