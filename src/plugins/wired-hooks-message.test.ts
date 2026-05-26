/**
 * Test: message_sending & message_sent hook wiring
 *
 * Tests the hook runner methods directly since outbound delivery is deeply integrated.
 */
import { describe, expect, it, vi } from "vitest";
import { createHookRunnerWithRegistry } from "./hooks.test-helpers.js";
import type {
  PluginHookMessageSendingEvent,
  PluginHookMessageSendingResult,
  PluginHookMessageSentEvent,
} from "./types.js";

async function expectMessageHookCall(params: {
  hookName: "message_sending" | "message_sent";
  event: PluginHookMessageSendingEvent | PluginHookMessageSentEvent;
  hookResult?: PluginHookMessageSendingResult;
  expectedResult?: PluginHookMessageSendingResult;
  channelCtx: { channelId: string };
}) {
  const handler =
    params.hookResult === undefined ? vi.fn() : vi.fn().mockReturnValue(params.hookResult);
  const { runner } = createHookRunnerWithRegistry([{ hookName: params.hookName, handler }]);

  if (params.hookName === "message_sending") {
    const result = await runner.runMessageSending(
      params.event as PluginHookMessageSendingEvent,
      params.channelCtx,
    );
    if (params.expectedResult === undefined) {
      expect(result).toBeUndefined();
    } else {
      expect(result).toEqual(params.expectedResult);
    }
  } else {
    await runner.runMessageSent(params.event as PluginHookMessageSentEvent, params.channelCtx);
  }

  expect(handler).toHaveBeenCalledWith(params.event, params.channelCtx);
}

describe("message_observed hook runner", () => {
  it("returns { handled: true } when handler signals handled", async () => {
    const handler = vi.fn().mockReturnValue({ handled: true });
    const { runner } = createHookRunnerWithRegistry([{ hookName: "message_observed", handler }]);

    const result = await runner.runMessageObserved(
      { from: "user-1", content: "hello", fromMe: false },
      { channelId: "whatsapp" },
    );

    expect(handler).toHaveBeenCalledWith(
      { from: "user-1", content: "hello", fromMe: false },
      { channelId: "whatsapp" },
    );
    expect(result?.handled).toBe(true);
  });

  it("returns undefined for void-returning handlers", async () => {
    const handler = vi.fn(); // returns undefined
    const { runner } = createHookRunnerWithRegistry([{ hookName: "message_observed", handler }]);

    const result = await runner.runMessageObserved(
      { from: "user-1", content: "hello", fromMe: false },
      { channelId: "whatsapp" },
    );

    expect(handler).toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it("handler receives fromMe field correctly", async () => {
    const handler = vi.fn().mockReturnValue({ handled: true });
    const { runner } = createHookRunnerWithRegistry([{ hookName: "message_observed", handler }]);

    await runner.runMessageObserved(
      { from: "+15555550123", content: "outbound msg", fromMe: true },
      { channelId: "whatsapp" },
    );

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ fromMe: true }),
      expect.anything(),
    );
  });
});

describe("message_sending hook runner", () => {
  const demoChannelCtx = { channelId: "demo-channel" };
  it.each([
    {
      name: "runMessageSending invokes registered hooks and returns modified content",
      event: { to: "user-123", content: "original content" },
      hookResult: { content: "modified content" },
      expected: { content: "modified content" },
    },
    {
      name: "runMessageSending can cancel message delivery",
      event: { to: "user-123", content: "blocked" },
      hookResult: { cancel: true, cancelReason: "policy", metadata: { owner: "agent-2" } },
      expected: { cancel: true, cancelReason: "policy", metadata: { owner: "agent-2" } },
    },
  ] as const)("$name", async ({ event, hookResult, expected }) => {
    await expectMessageHookCall({
      hookName: "message_sending",
      event,
      hookResult,
      expectedResult: expected,
      channelCtx: demoChannelCtx,
    });
  });
});

describe("message_sent hook runner", () => {
  const demoChannelCtx = { channelId: "demo-channel" };

  it.each([
    {
      name: "runMessageSent invokes registered hooks with success=true",
      event: { to: "user-123", content: "hello", success: true },
    },
    {
      name: "runMessageSent invokes registered hooks with error on failure",
      event: { to: "user-123", content: "hello", success: false, error: "timeout" },
    },
  ] as const)("$name", async ({ event }) => {
    await expectMessageHookCall({
      hookName: "message_sent",
      event,
      channelCtx: demoChannelCtx,
    });
  });
});
