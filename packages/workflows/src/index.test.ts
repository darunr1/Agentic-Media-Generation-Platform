import { describe, expect, it } from "vitest";

import { CircuitBreaker, assertTransition, canTransition, retryDelayMs } from "./index";
describe("workflow controls", () => {
  it("allows only explicit transitions", () => {
    expect(canTransition("DRAFT", "PLANNING")).toBe(true);
    expect(() => assertTransition("DRAFT", "PUBLISHED")).toThrow();
  });
  it("bounds exponential backoff", () =>
    expect(retryDelayMs(99, 500, 60000, () => 0.5)).toBe(60000));
  it("opens and recovers the circuit", () => {
    const breaker = new CircuitBreaker(2, 100);
    breaker.failure(0);
    breaker.failure(1);
    expect(breaker.state).toBe("OPEN");
    expect(breaker.canExecute(102)).toBe(true);
  });
});
