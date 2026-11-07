"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import "@near-wallet-selector/modal-ui/styles.css";
import { DEPLOY } from "@/lib/near";

interface Ctx {
  accountId: string | null;
  ready: boolean;
  connect: () => void;
  disconnect: () => void;
  call: (receiverId: string, method: string, args: Record<string, unknown>, opts?: { deposit?: string; gas?: string }) => Promise<void>;
}
const WalletCtx = createContext<Ctx>({ accountId: null, ready: false, connect() {}, disconnect() {}, async call() {} });
export const useWallet = () => useContext(WalletCtx);

/* eslint-disable @typescript-eslint/no-explicit-any */
export function WalletProvider({ children }: { children: React.ReactNode }) {
  const selector = useRef<any>(null);
  const modal = useRef<any>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let sub: { unsubscribe: () => void } | undefined;
    (async () => {
      try {
        const { setupWalletSelector } = await import("@near-wallet-selector/core");
        const { setupModal } = await import("@near-wallet-selector/modal-ui");
        const { setupMeteorWallet } = await import("@near-wallet-selector/meteor-wallet");
        const { setupMyNearWallet } = await import("@near-wallet-selector/my-near-wallet");
        const s = await setupWalletSelector({ network: "testnet", modules: [setupMeteorWallet(), setupMyNearWallet()] });
        selector.current = s;
        modal.current = setupModal(s, { contractId: DEPLOY.circle ?? "testnet" });
        const cur = s.store.getState().accounts.find((a: any) => a.active);
        setAccountId(cur?.accountId ?? null);
        sub = s.store.observable.subscribe((st: any) => setAccountId(st.accounts.find((a: any) => a.active)?.accountId ?? null));
        setReady(true);
      } catch (e) {
        console.error("wallet init failed", e);
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

  return <WalletCtx.Provider value={{ accountId, ready, connect, disconnect, call }}>{children}</WalletCtx.Provider>;
}

export function ConnectButton() {
  const { accountId, connect, disconnect, ready } = useWallet();
  return accountId ? (
    <button className="btn small" onClick={disconnect} title="Disconnect">{accountId.length > 18 ? accountId.slice(0, 16) + "…" : accountId} ✕</button>
  ) : (
    <button className="btn small" onClick={connect} disabled={!ready}>Connect wallet</button>
  );
}
