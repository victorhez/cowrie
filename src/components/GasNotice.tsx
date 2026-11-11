export default function GasNotice() {
  return (
    <div className="notice" style={{ marginBottom: 16 }}>
      <b>You need a little testnet NEAR for gas.</b> Cowrie does not sponsor gas yet (members pay it themselves).
      Get free testnet NEAR from the{" "}
      <a className="lime" href="https://near-faucet.io/" target="_blank" rel="noreferrer">NEAR testnet faucet</a>, then use
      the <b>Get test mock-usdc</b> button on a circle page. Both are test funds with no value.
    </div>
  );
}
