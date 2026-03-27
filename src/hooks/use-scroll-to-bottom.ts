import { useCallback, useRef, useState } from "react";

/**
 * Scroll hook inspired by Claude's web app behavior:
 * - When user sends a message, scroll their message to the top of the viewport
 * - Do NOT auto-scroll to bottom as content streams in
 * - User controls scrolling from there
 * - "Scroll to bottom" button appears when not at bottom
 */
export function useScrollToBottom() {
  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Scroll to absolute bottom (for the button)
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    if (!containerRef.current) return;
    containerRef.current.scrollTo({
      top: containerRef.current.scrollHeight,
      behavior,
    });
    setIsAtBottom(true);
  }, []);

  // Scroll a specific element into view (for scrolling user message to top)
  const scrollToElement = useCallback((el: HTMLElement, behavior: ScrollBehavior = "smooth") => {
    if (!containerRef.current) return;
    const containerTop = containerRef.current.getBoundingClientRect().top;
    const elTop = el.getBoundingClientRect().top;
    const offset = elTop - containerTop + containerRef.current.scrollTop;
    containerRef.current.scrollTo({
      top: offset - 16, // small padding above
      behavior,
    });
  }, []);

  // Track scroll position to show/hide "scroll to bottom" button
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const atBottom = scrollTop + clientHeight >= scrollHeight - 100;
    setIsAtBottom(atBottom);
  }, []);

  const reset = useCallback(() => {
    setIsAtBottom(true);
  }, []);

  return {
    containerRef,
    endRef,
    isAtBottom,
    scrollToBottom,
    scrollToElement,
    handleScroll,
    reset,
  };
}
