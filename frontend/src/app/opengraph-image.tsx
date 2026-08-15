import { ImageResponse } from "next/og";

import { SITE_DESCRIPTION } from "@/lib/site";

export const alt = "orbitWx — Will It Rain On My Parade?";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Generated at build time so the OG tags point at a real image. */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          backgroundColor: "#0B0E14",
          backgroundImage:
            "radial-gradient(900px 600px at 85% -10%, rgba(255,122,26,0.22), transparent 60%), radial-gradient(700px 500px at 5% 10%, rgba(34,211,238,0.12), transparent 62%)",
          color: "#F2F5FA",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 26,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "#FF7A1A",
          }}
        >
          NASA Space Apps Challenge 2025 · Team Coders
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 28,
            fontSize: 86,
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: -2,
          }}
        >
          Will it rain on your parade?
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 28,
            maxWidth: 900,
            fontSize: 30,
            lineHeight: 1.4,
            color: "#9AA6BD",
          }}
        >
          {SITE_DESCRIPTION.split(". ")[0]}.
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 48,
            gap: 40,
            fontSize: 24,
            color: "#63708A",
          }}
        >
          <span style={{ color: "#FF7A1A", fontWeight: 700 }}>orbitWx</span>
          <span>30 years · 1996–2025</span>
          <span>NASA POWER / MERRA-2</span>
        </div>
      </div>
    ),
    size,
  );
}
