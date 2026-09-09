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
      <div className="rounded-xl border border-zinc-700 bg-zinc-800/40 p-4 text-sm text-zinc-400">
        Signaling-only proposal — no on-chain action will be executed.
      </div>
    );
  }

  const decoded = decodeProposalCall(target, data);

  return (
    <div className="space-y-2 rounded-xl border border-zinc-700 bg-zinc-800/40 p-4 text-sm">
      <div className="flex flex-wrap justify-between gap-2">
        <span className="text-zinc-500">Target</span>
        <span className="font-mono text-zinc-200">{target}</span>
      </div>

      <div className="flex flex-wrap justify-between gap-2">
        <span className="text-zinc-500">ETH Value</span>
        <span className="font-mono text-zinc-200">{formatEther(value)} ETH</span>
      </div>

      {decoded ? (
        <div className="flex flex-wrap justify-between gap-2">
          <span className="text-zinc-500">Call</span>
          <span className="text-right font-mono text-emerald-300">
            {decoded.contractLabel}.{decoded.functionSignature}
            {decoded.args.length > 0 && (
              <span className="text-zinc-400">
                ({decoded.args.join(", ")})
              </span>
            )}
          </span>
        </div>
      ) : (
        <div className="flex flex-wrap justify-between gap-2">
          <span className="text-zinc-500">Calldata (undecoded)</span>
          <span className="max-w-full break-all text-right font-mono text-zinc-400">
            {data}
          </span>
        </div>
      )}
    </div>
  );
}
