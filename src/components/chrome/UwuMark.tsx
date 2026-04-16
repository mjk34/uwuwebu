type UwuMarkProps = {
  className?: string;
  title?: string;
};

export default function UwuMark({ className, title = "UwUversity" }: UwuMarkProps) {
  return (
    <span
      aria-label={title}
      className={`inline-flex items-center leading-none ${className ?? ""}`}
    >
      <svg
        viewBox="0 0 480 160"
        role="img"
        aria-hidden="true"
        className="h-[1em] w-auto block"
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
