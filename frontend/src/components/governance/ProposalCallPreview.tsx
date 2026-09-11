import { formatEther, ZeroAddress } from "ethers";

import { decodeProposalCall } from "../../utils/calldata";

type Props = {
  target: string;
  value: bigint;
  data: string;
};

// Shows exactly what on-chain call a proposal will execute — target, ETH
// value, and calldata are always shown as raw values; a decoded function
// name/args is layered on top ONLY when the target is a known StakeVerse
// contract and the calldata matches one of its functions. This never
// substitutes for, or hides, the raw target/value/data — arbitrary
// execution is never presented as if it were a simple local UI action.
export default function ProposalCallPreview({ target, value, data }: Props) {
  const isSignalingOnly = !target || target === ZeroAddress;

  if (isSignalingOnly) {
    return (
      <div className="rounded-sv-md border border-sv-border bg-sv-black-950 p-4 text-sm text-sv-text-muted">
        Signaling-only proposal — no on-chain action will be executed.
      </div>
    );
  }

  const decoded = decodeProposalCall(target, data);

  return (
    <div className="space-y-2 rounded-sv-md border border-sv-border bg-sv-black-950 p-4 text-sm">
      <div className="flex flex-wrap justify-between gap-2">
        <span className="sv-text-label">Target</span>
        <span className="sv-text-identifier">{target}</span>
      </div>

      <div className="flex flex-wrap justify-between gap-2">
        <span className="sv-text-label">ETH Value</span>
        <span className="sv-text-technical">{formatEther(value)} ETH</span>
      </div>

      {decoded ? (
        <div className="flex flex-wrap justify-between gap-2">
          <span className="sv-text-label">Call</span>
          <span className="text-right sv-text-identifier text-sv-orange-400">
            {decoded.contractLabel}.{decoded.functionSignature}
            {decoded.args.length > 0 && (
              <span className="text-sv-text-muted">
                ({decoded.args.join(", ")})
              </span>
            )}
          </span>
        </div>
      ) : (
        <div className="flex flex-wrap justify-between gap-2">
          <span className="sv-text-label">Calldata (undecoded)</span>
          <span className="max-w-full break-all text-right sv-text-identifier">
            {data}
          </span>
        </div>
      )}
    </div>
  );
}
