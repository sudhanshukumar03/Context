export function WordmarkDark() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-12"
         style={{ background: "#080c14" }}>

      <LogoFull size={52} />
      <LogoFull size={36} />
      <LogoFull size={24} />

      <p style={{ color: "rgba(255,255,255,0.12)", fontSize: 11, letterSpacing: "0.18em", fontFamily: "Inter, sans-serif", fontWeight: 500, textTransform: "uppercase", marginTop: 8 }}>
        Context — Dark Wordmark
      </p>
    </div>
  );
}

function LogoFull({ size }: { size: number }) {
  const markH = size;
  const markW = markH * (48 / 46);
  const bars = [
    { w: 16, y: 0,  opacity: 0.32, accent: false },
    { w: 24, y: 10, opacity: 0.52, accent: false },
    { w: 32, y: 20, opacity: 0.70, accent: false },
    { w: 40, y: 30, opacity: 0.88, accent: false },
    { w: 48, y: 40, opacity: 1,    accent: true  },
  ];

  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.42 }}>
      <svg
        width={markW}
        height={markH}
        viewBox="0 0 48 46"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
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

      <span style={{
        fontFamily: "Inter, system-ui, sans-serif",
        fontWeight: 500,
        fontSize: size * 0.88,
        letterSpacing: "-0.02em",
        color: "#ffffff",
        lineHeight: 1,
        userSelect: "none",
      }}>
        Context
      </span>
    </div>
  );
}
