type Props = {
  title: string;
  value: string;
  subtitle: string;
  /** Numeric protocol values render in the technical/mono treatment by
   * default. Set false for a card whose "value" is prose, not a number. */
  technical?: boolean;
};

export default function StatCard({
  title,
  value,
  subtitle,
  technical = true,
}: Props) {
  return (
    <div className="rounded-sv-lg border border-sv-border bg-sv-black-900 p-6">
      <p className="sv-text-label">{title}</p>

      <h3
        className={`mt-3 mb-2 text-2xl ${
          technical ? "sv-text-technical" : "sv-text-h2"
        }`}
      >
        {value}
      </h3>

      <p className="sv-text-metadata">{subtitle}</p>
    </div>
  );
}
