type UwuMarkProps = {
  className?: string;
  title?: string;
};

export default function UwuMark({ className, title = "UwUversity" }: UwuMarkProps) {
  return (
    <span
      aria-label={title}
      className={className}
      style={{ display: "inline-flex", alignItems: "center", lineHeight: 1 }}
    >
      <svg
        viewBox="0 0 480 160"
        role="img"
        aria-hidden="true"
        style={{ height: "1em", width: "auto", display: "block" }}
      >
        <text
          x="240"
          y="124"
          textAnchor="middle"
          fontFamily="var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif"
          fontWeight={900}
          fontSize={160}
          letterSpacing={-6}
          fill="currentColor"
        >
          UWU
        </text>
      </svg>
    </span>
  );
}
