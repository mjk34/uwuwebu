type BiasBarProps = {
  bias: number; // -1 (left) .. +1 (right)
};

export default function BiasBar({ bias }: BiasBarProps) {
  const pct = Math.round(((bias + 1) / 2) * 100); // 0=left, 50=neutral, 100=right
  const abs = Math.abs(bias);
  const isL = bias < -0.15;
  const isR = bias > 0.15;
  const dotColor = isL ? "#00f0ff" : isR ? "#ff2a6d" : "#ffffff";
  const dotSize = 6 + Math.round(abs * 10);
  const shadow = `0 0 ${Math.round(abs * 8) + 4}px ${dotColor}99`;
  const valColor = dotColor;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: "var(--font-jetbrains-mono),monospace" }}>
      <span style={{ fontSize: 11, color: "#00f0ff", fontWeight: 700, letterSpacing: 1 }}>0</span>
      <div style={{ position: "relative", width: 80, height: 3, background: "rgba(133,142,170,0.1)", borderRadius: 2 }}>
        {/* solid fill from center toward dot */}
        <div style={{
          position: "absolute", top: 0, bottom: 0, borderRadius: 2,
          left: isL ? `${pct}%` : "50%",
          right: isR ? `${100 - pct}%` : "50%",
          background: dotColor,
        }} />
        {/* center tick */}
        <div style={{ position: "absolute", left: "calc(50% - 0.5px)", top: -3, width: 1, height: 9, background: "rgba(133,142,170,0.2)" }} />
        {/* dot */}
        <div style={{
          position: "absolute",
          width: dotSize, height: dotSize, borderRadius: "50%",
          background: dotColor,
          top: `${-(dotSize / 2) + 1.5}px`,
          left: `calc(${pct}% - ${dotSize / 2}px)`,
          boxShadow: shadow,
          transition: "left 0.25s ease, width 0.25s ease, height 0.25s ease, top 0.25s ease, background 0.25s ease, box-shadow 0.25s ease",
        }} />
      </div>
      <span style={{ fontSize: 11, color: "#ff2a6d", fontWeight: 700, letterSpacing: 1 }}>100</span>
      <span style={{
        fontSize: 11, fontWeight: 700, padding: "2px 8px",
        border: `1px solid ${valColor}33`, borderRadius: 4,
        fontFamily: "var(--font-jetbrains-mono),monospace", color: valColor,
      }}>{pct}</span>
    </div>
  );
}
