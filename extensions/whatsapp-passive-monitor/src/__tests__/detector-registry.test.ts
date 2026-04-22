import { describe, it, expect, vi } from "vitest";
import { createDetectorRegistry } from "../detector-registry.ts";
import type { DetectorExecCtx } from "../interfaces/detector.ts";
import type { Logger } from "../types.ts";

const ctx: DetectorExecCtx = { conversationId: "chat-1" };

const createMockLogger = (): Logger => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
});

describe("DetectorRegistry", () => {
  it("runAll calls each detector sequentially with the context", async () => {
    const order: number[] = [];
    const detector1 = vi.fn(async () => {
      order.push(1);
    });
    const detector2 = vi.fn(async () => {
      order.push(2);
    });

    const registry = createDetectorRegistry(createMockLogger());
    registry.add(detector1);
    registry.add(detector2);
    await registry.runAll(ctx);

    expect(detector1).toHaveBeenCalledWith(ctx);
    expect(detector2).toHaveBeenCalledWith(ctx);
    expect(order).toEqual([1, 2]);
  });

  it("runAll continues when a detector throws", async () => {
    const failing = vi.fn(async () => {
      throw new Error("boom");
    });
    const passing = vi.fn(async () => {});

    const registry = createDetectorRegistry(createMockLogger());
    registry.add(failing);
    registry.add(passing);
    await registry.runAll(ctx);

    expect(passing).toHaveBeenCalledWith(ctx);
  });

  it("logs via logger.error when a detector throws", async () => {
    const failing = vi.fn(async () => {
      throw new Error("boom");
    });
    const logger = createMockLogger();

    const registry = createDetectorRegistry(logger);
    registry.add(failing);
    await registry.runAll(ctx);

    expect(logger.error).toHaveBeenCalledWith("detector-registry: detector failed: Error: boom");
  });

  it("runAll is a no-op when no detectors are registered", async () => {
    const registry = createDetectorRegistry(createMockLogger());
    await expect(registry.runAll(ctx)).resolves.toBeUndefined();
  });

  it("add accumulates detectors", async () => {
    const detectors = [vi.fn(async () => {}), vi.fn(async () => {}), vi.fn(async () => {})];

    const registry = createDetectorRegistry(createMockLogger());
    for (const d of detectors) {
      registry.add(d);
    }
    await registry.runAll(ctx);

    for (const d of detectors) {
      expect(d).toHaveBeenCalledOnce();
    }
  });
});
