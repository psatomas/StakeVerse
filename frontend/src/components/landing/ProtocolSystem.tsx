import SectionShell from "./SectionShell";
import ArchitectureDiagram from "./ArchitectureDiagram";

export default function ProtocolSystem() {
  return (
    <SectionShell
      id="system"
      index="01"
      kicker="Protocol System"
      title="Five contracts, one authority structure"
      description="Not five unrelated cards — a DAO-owned core (token, staking, itself) plus two components that deliberately sit outside the execution path. Hover or focus any component below."
    >
      <ArchitectureDiagram />
    </SectionShell>
  );
}
