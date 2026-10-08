export function SymbolDark() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-16"
         style={{ background: "#080c14" }}>

      <div className="flex flex-col items-center gap-10">
        <ContextMark size={96} />
        <ContextMark size={64} />
        <ContextMark size={40} />
      </div>

      <p style={{ color: "rgba(255,255,255,0.12)", fontSize: 11, letterSpacing: "0.18em", fontFamily: "Inter, sans-serif", fontWeight: 500, textTransform: "uppercase" }}>
        Context — Primary Mark
      </p>
    </div>
  );
}

function ContextMark({ size }: { size: number }) {
  const unit = size / 48;
  const bars = [
    { w: 16, y: 0,  opacity: 0.32, accent: false },
    { w: 24, y: 10, opacity: 0.52, accent: false },
    { w: 32, y: 20, opacity: 0.70, accent: false },
    { w: 40, y: 30, opacity: 0.88, accent: false },
    { w: 48, y: 40, opacity: 1,    accent: true  },
  ];

  return (
    <svg
      width={size}
      height={size * (46 / 48)}
      viewBox="0 0 48 46"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {bars.map((bar, i) => (
        <rect
          key={i}
          x={48 - bar.w}
          y={bar.y}
          width={bar.w}
          height={6}
          rx={1}
          fill={bar.accent ? "#6366F1" : "#ffffff"}
          fillOpacity={bar.accent ? 1 : bar.opacity}
        />
      ))}
    </svg>
  );
}
