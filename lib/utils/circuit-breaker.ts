/**
 * Circuit Breaker pattern for High Availability (SLA >= 99.99%)
 * Prevents cascading failures and protects against failing external services.
 */

type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export type CircuitBreakerOptions = {
  failureThreshold?: number; // Number of failures before opening circuit (default 5)
  resetTimeoutMs?: number;   // Time to wait in OPEN state before trying HALF_OPEN (default 10000ms)
  timeoutMs?: number;        // Request timeout (default 5000ms)
};

export class CircuitBreaker {
  private state: CircuitState = "CLOSED";
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly timeoutMs: number;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetTimeoutMs = options.resetTimeoutMs ?? 10000;
    this.timeoutMs = options.timeoutMs ?? 5000;
  }

  public async execute<T>(fn: () => Promise<T>, fallback?: () => Promise<T> | T): Promise<T> {
    const now = Date.now();

    if (this.state === "OPEN") {
      if (now - this.lastFailureTime > this.resetTimeoutMs) {
        this.state = "HALF_OPEN";
      } else {
        if (fallback) return fallback();
        throw new Error("Circuit breaker is OPEN: service temporarily unavailable");
      }
    }

    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Operation timed out")), this.timeoutMs)
      );

      const result = await Promise.race([fn(), timeoutPromise]);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      if (fallback) return fallback();
      throw error;
    }
  }

  private onSuccess() {
    this.failureCount = 0;
    this.state = "CLOSED";
  }

  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold || this.state === "HALF_OPEN") {
      this.state = "OPEN";
    }
  }

  public getState(): CircuitState {
    return this.state;
  }
}
