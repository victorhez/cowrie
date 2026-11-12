"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import "@near-wallet-selector/modal-ui/styles.css";
import { DEPLOY } from "@/lib/near";

interface Ctx {
  accountId: string | null;
  ready: boolean;
  initError: boolean;
  connect: () => void;
  disconnect: () => void;
  call: (receiverId: string, method: string, args: Record<string, unknown>, opts?: { deposit?: string; gas?: string }) => Promise<void>;
}
const WalletCtx = createContext<Ctx>({ accountId: null, ready: false, initError: false, connect() {}, disconnect() {}, async call() {} });
export const useWallet = () => useContext(WalletCtx);

/* eslint-disable @typescript-eslint/no-explicit-any */
export function WalletProvider({ children }: { children: React.ReactNode }) {
  const selector = useRef<any>(null);
  const modal = useRef<any>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState(false);

  useEffect(() => {
    let sub: { unsubscribe: () => void } | undefined;
    (async () => {
      try {
        const { setupWalletSelector } = await import("@near-wallet-selector/core");
        const { setupModal } = await import("@near-wallet-selector/modal-ui");
        // Each wallet module is loaded on its own so one failing package cannot remove the others.
        // Browser-extension wallets (Sender, Nightly, Bitget, OKX) appear when the extension is installed.
        const loaders: Array<[string, () => Promise<any>]> = [
          ["meteor", async () => (await import("@near-wallet-selector/meteor-wallet")).setupMeteorWallet()],
          ["mynearwallet", async () => (await import("@near-wallet-selector/my-near-wallet")).setupMyNearWallet()],
          ["sender", async () => (await import("@near-wallet-selector/sender")).setupSender()],
          ["nightly", async () => (await import("@near-wallet-selector/nightly")).setupNightly()],
          ["bitget", async () => (await import("@near-wallet-selector/bitget-wallet")).setupBitgetWallet()],
          ["okx", async () => (await import("@near-wallet-selector/okx-wallet")).setupOKXWallet()],
          ["here", async () => (await import("@near-wallet-selector/here-wallet")).setupHereWallet()],
          ["hot", async () => (await import("@near-wallet-selector/hot-wallet")).setupHotWallet()],
          ["intear", async () => (await import("@near-wallet-selector/intear-wallet")).setupIntearWallet()],
          ["ledger", async () => (await import("@near-wallet-selector/ledger")).setupLedger()],
        ];
        const modules: any[] = [];
        for (const [name, load] of loaders) {
          try { modules.push(await load()); } catch (e) { console.warn("wallet module skipped:", name, e); }
        }
        if (modules.length === 0) throw new Error("no wallet modules could be loaded");
        const s = await setupWalletSelector({ network: "testnet", modules });
        selector.current = s;
        modal.current = setupModal(s, { contractId: DEPLOY.circle ?? "testnet" });
        const cur = s.store.getState().accounts.find((a: any) => a.active);
        setAccountId(cur?.accountId ?? null);
        sub = s.store.observable.subscribe((st: any) => setAccountId(st.accounts.find((a: any) => a.active)?.accountId ?? null));
        setReady(true);
      } catch (e) {
        console.error("wallet init failed", e);
        setInitError(true);
      }
    })();
    return () => sub?.unsubscribe();
  }, []);

  const connect = useCallback(() => modal.current?.show(), []);
  const disconnect = useCallback(async () => {
    const w = await selector.current?.wallet();
    await w?.signOut();
    setAccountId(null);
  }, []);
  const call: Ctx["call"] = useCallback(async (receiverId, method, args, opts) => {
    const w = await selector.current.wallet();
    await w.signAndSendTransaction({
      receiverId,
      actions: [{ type: "FunctionCall", params: { methodName: method, args, gas: opts?.gas ?? "100000000000000", deposit: opts?.deposit ?? "0" } }],
    });
  }, []);

  return <WalletCtx.Provider value={{ accountId, ready, initError, connect, disconnect, call }}>{children}</WalletCtx.Provider>;
}

export function ConnectButton() {
  const { accountId, connect, disconnect, ready, initError } = useWallet();
  return accountId ? (
    <button className="btn small" onClick={disconnect} title="Disconnect">{accountId.length > 18 ? accountId.slice(0, 16) + "…" : accountId} ✕</button>
  ) : (
    <button className="btn small" onClick={initError ? () => window.location.reload() : connect} disabled={!ready && !initError}
      title={initError ? "Wallet list failed to load. Click to reload." : undefined}>{initError ? "Wallets failed: reload" : "Connect wallet"}</button>
  );
}
