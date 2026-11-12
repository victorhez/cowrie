import { describe, it, expect } from "vitest";
import { transactions } from "near-api-js";
import { najActionToInternal } from "@near-wallet-selector/core";

// Wallet Selector v10 wallets accept NAJ actions only. The old { type, params } shape fails with "Unsupported NAJ action".
describe("wallet action format", () => {
  it("a NAJ function call converts to the wallet's internal form", () => {
    const a = transactions.functionCall("create_circle", { name: "x", members: 5 }, 100_000_000_000_000n, 0n);
    expect(najActionToInternal(a)).toMatchObject({ type: "FunctionCall", params: { methodName: "create_circle", gas: "100000000000000", deposit: "0" } });
  });
  it("the old object shape is rejected (the bug)", () => {
    expect(() => najActionToInternal({ type: "FunctionCall", params: {} } as never)).toThrow("Unsupported NAJ action");
  });
});
