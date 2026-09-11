import SectionShell from "../landing/SectionShell";
import ArchitectureDiagram from "../landing/ArchitectureDiagram";

// The exact same component Overview uses — same typed relationships, same
// resting-state legibility, same mobile fallback. Reused as-is rather than
// duplicated: the two pages should never be able to disagree about what
// owns what.
export default function ProtocolArchitecture() {
  return (
    <SectionShell
      id="protocol-contracts"
      index="02"
      kicker="Contracts / Architecture"
      title="The same structure, cross-checked below"
      description="Identical to the diagram on Overview — this page doesn't redraw the relationships, it verifies the ownership edges against live chain state in Authority further down."
    >
      <ArchitectureDiagram />
    </SectionShell>
  );
}
