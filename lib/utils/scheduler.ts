/**
 * Modern Main Thread Scheduler & Task Slicer
 * Standard: Web Performance Specification v1.0
 * 
 * Complies with Core Web Vitals (INP <= 200ms) and avoids Long Tasks (>50ms).
 * Implements native scheduler.yield() with high-performance MessageChannel fallback.
 */

declare global {
  interface Window {
    scheduler?: {
      yield?: () => Promise<void>;
      postTask?: (callback: () => unknown, options?: { priority?: "user-blocking" | "user-visible" | "background" }) => Promise<unknown>;
    };
  }
}

/**
 * Yields execution to the browser main thread so that pending user inputs,
 * taps, clicks, and paints can be processed immediately without INP latency.
 */
export async function yieldToMain(): Promise<void> {
  if (typeof window === "undefined") return;

  // 1. Native scheduler.yield() - Chrome 129+, Edge 129+
  if ("scheduler" in window && typeof window.scheduler?.yield === "function") {
    try {
      await window.scheduler.yield();
      return;
    } catch {
      // Fallback if yield throws or is disabled
    }
  }

  // 2. High-performance microtask/macrotask interleaver via MessageChannel
  // (significantly faster and lower latency than setTimeout(..., 0))
  if (typeof MessageChannel !== "undefined") {
    return new Promise((resolve) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = () => {
        channel.port1.close();
        channel.port2.close();
        resolve();
      };
      channel.port2.postMessage(null);
    });
  }

  // 3. Ultimate fallback
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Splits an array into chunks and processes them with scheduler.yield()
 * between chunks to prevent long-running tasks.
 */
export async function processInChunks<T, R>(
  items: T[],
  chunkSize: number,
  processor: (item: T, index: number) => R | Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  const start = typeof performance !== "undefined" ? performance.now() : Date.now();

  for (let i = 0; i < items.length; i++) {
    results.push(await processor(items[i], i));

    // Yield every `chunkSize` items or if we've spent more than 16ms in this task
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    if ((i + 1) % chunkSize === 0 || now - start > 16) {
      await yieldToMain();
    }
  }

  return results;
}
