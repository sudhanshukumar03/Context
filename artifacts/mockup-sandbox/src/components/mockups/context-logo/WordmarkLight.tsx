export function WordmarkLight() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-12"
         style={{ background: "#f0f2f7" }}>

      <LogoFull size={52} bg="light" />
      <LogoFull size={36} bg="light" />
      <LogoFull size={24} bg="light" />

      <p style={{ color: "rgba(15,23,42,0.25)", fontSize: 11, letterSpacing: "0.18em", fontFamily: "Inter, sans-serif", fontWeight: 500, textTransform: "uppercase", marginTop: 8 }}>
        Context — Light Wordmark
      </p>
    </div>
  );
}

function LogoFull({ size, bg }: { size: number; bg: "dark" | "light" }) {
  const markH = size;
  const markW = markH * (48 / 46);
  const isLight = bg === "light";

  const bars = [
    { w: 16, y: 0,  opacity: 0.20, accent: false },
    { w: 24, y: 10, opacity: 0.38, accent: false },
    { w: 32, y: 20, opacity: 0.56, accent: false },
    { w: 40, y: 30, opacity: 0.74, accent: false },
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
            fill={bar.accent ? "#6366F1" : isLight ? "#0f172a" : "#ffffff"}
            fillOpacity={bar.accent ? 1 : bar.opacity}
          />
        ))}
      </svg>

      <span style={{
        fontFamily: "Inter, system-ui, sans-serif",
        fontWeight: 500,
        fontSize: size * 0.88,
        letterSpacing: "-0.02em",
        color: isLight ? "#0f172a" : "#ffffff",
        lineHeight: 1,
        userSelect: "none",
      }}>
        Context
      </span>
    </div>
  );
}
