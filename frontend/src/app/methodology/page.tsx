import type { Metadata } from "next";
import Link from "next/link";

import { ClimatologyNote } from "@/components/climatology-note";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "How orbitWx computes weather probabilities: day-of-year window sampling, empirical exceedance probability, the NOAA heat index, and linear trend regression over 30 years of NASA POWER data.",
};

function Section({
  id,
  title,
  eyebrow,
  children,
}: {
  id: string;
  title: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">
        {eyebrow}
      </p>
      <h2 className="font-display mt-1 text-2xl font-bold tracking-tight">
        {title}
      </h2>
      <div className="mt-4 space-y-4 text-sm leading-relaxed text-ink-muted">
        {children}
      </div>
    </section>
  );
}

function Formula({ children }: { children: React.ReactNode }) {
  return (
    <pre className="overflow-x-auto rounded-xl border border-hairline bg-white/[0.03] p-4 text-[11px] leading-relaxed text-ink">
      <code>{children}</code>
    </pre>
  );
}

const VARIABLES: [string, string, string][] = [
  ["T2M_MAX", "Daily maximum temperature at 2 m", "°C"],
  ["T2M_MIN", "Daily minimum temperature at 2 m", "°C"],
  ["T2M", "Daily mean temperature at 2 m", "°C"],
  ["PRECTOTCORR", "Bias-corrected total precipitation", "mm/day"],
  ["WS10M", "Wind speed at 10 m", "m/s"],
  ["WS2M", "Wind speed at 2 m", "m/s"],
  ["RH2M", "Relative humidity at 2 m", "%"],
  ["T2MDEW", "Dew point at 2 m", "°C"],
];

export default function MethodologyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <Badge tone="accent">Methodology</Badge>
      <h1 className="font-display mt-4 text-4xl font-bold tracking-tight">
        How orbitWx computes the odds
      </h1>
      <p className="mt-4 text-base leading-relaxed text-ink-muted">
        Every number in this app is an empirical frequency drawn from three
        decades of NASA satellite-derived observations. Nothing is modelled,
        forecast or interpolated beyond what NASA POWER already publishes.
      </p>

      <ClimatologyNote className="mt-6" />

      <div className="mt-12 space-y-14">
        <Section id="source" eyebrow="Step 0" title="The data source">
          <p>
            orbitWx reads the{" "}
            <a
              href="https://power.larc.nasa.gov/docs/services/api/temporal/daily/"
              target="_blank"
              rel="noreferrer"
              className="text-ink underline decoration-dotted underline-offset-2 hover:text-accent"
            >
              NASA POWER Daily Point API
            </a>
            . POWER serves meteorology derived from NASA&apos;s{" "}
            <strong className="text-ink">MERRA-2</strong> assimilation model —
            satellite observations fused with a physical reanalysis — available
            from 1 January 1981 to near-present on a{" "}
            <strong className="text-ink">0.5° × 0.625°</strong> latitude/longitude
            grid.
          </p>
          <p>
            We use <strong className="text-ink">1996-01-01 → 2025-12-31</strong>:
            exactly 30 full calendar years. Your coordinates are snapped to the
            grid cell POWER actually serves, and the cell used is reported back
            in every response.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-ink-faint">
                <tr className="border-b border-hairline">
                  <th className="py-2 pr-4 font-medium">Parameter</th>
                  <th className="py-2 pr-4 font-medium">Meaning</th>
                  <th className="py-2 font-medium">Unit</th>
                </tr>
              </thead>
              <tbody className="text-ink-muted">
                {VARIABLES.map(([code, meaning, unit]) => (
                  <tr key={code} className="border-b border-hairline/60">
                    <td className="py-2 pr-4 font-mono text-[11px] text-accent">
                      {code}
                    </td>
                    <td className="py-2 pr-4">{meaning}</td>
                    <td className="tabular py-2">{unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            POWER marks missing observations with the fill value{" "}
            <code className="text-accent">-999</code>. Those are removed before
            any calculation and counted in{" "}
            <code className="text-accent">metadata.fill_value_days</code>.
          </p>
        </Section>

        <Section
          id="sampling"
          eyebrow="Step 1"
          title="Day-of-year window sampling"
        >
          <p>
            A single calendar date gives only 30 observations in 30 years — far
            too few for a stable probability. So orbitWx widens the target date
            into a <strong className="text-ink">±7-day window</strong> (adjustable
            1–15) and pools every matching day across every year:
          </p>
          <Formula>{`15 days per year × 30 years = up to 450 observations`}</Formula>
          <p>
            The window is built with real date arithmetic in each year, so it
            wraps correctly across the year boundary — a January 3rd target
            reaches back into the previous December. A February 29th target falls
            back to February 28th in non-leap years so leap-day events still get
            the full record.
          </p>
          <p className="text-ink-faint">
            Trade-off: a wider window buys statistical stability at the cost of
            seasonal sharpness. Seven days is the default because most climates
            change slowly over a fortnight, but the slider is there if your
            location&apos;s season turns fast.
          </p>
        </Section>

        <Section
          id="probability"
          eyebrow="Step 2"
          title="Empirical exceedance probability"
        >
          <p>
            For each condition we simply count. No distribution is fitted, no
            parameters are estimated — the probability is the observed frequency:
          </p>
          <Formula>{`P(condition) = count(days breaching threshold) / count(valid days)`}</Formula>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-ink-faint">
                <tr className="border-b border-hairline">
                  <th className="py-2 pr-4 font-medium">Condition</th>
                  <th className="py-2 pr-4 font-medium">Variable</th>
                  <th className="py-2 font-medium">Default threshold</th>
                </tr>
              </thead>
              <tbody className="text-ink-muted">
                {[
                  ["Very Hot", "T2M_MAX", "> 35 °C"],
                  ["Very Cold", "T2M_MIN", "< 5 °C"],
                  ["Very Windy", "WS10M", "> 10 m/s"],
                  ["Very Wet", "PRECTOTCORR", "> 10 mm/day"],
                  ["Very Uncomfortable", "Heat index", "> 40 °C"],
                ].map(([label, variable, threshold]) => (
                  <tr key={label} className="border-b border-hairline/60">
                    <td className="py-2 pr-4 text-ink">{label}</td>
                    <td className="py-2 pr-4 font-mono text-[11px] text-accent">
                      {variable}
                    </td>
                    <td className="tabular py-2">{threshold}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Rainfall is additionally reported at three fixed tiers — ≥ 1 mm
            (&ldquo;any rain&rdquo;), ≥ 5 mm and ≥ 10 mm — regardless of your
            threshold, because &ldquo;will it rain on my parade&rdquo; is really a
            question about any rain at all.
          </p>
          <p>
            Each condition also reports where your threshold sits inside the local
            distribution. &ldquo;35 °C is the 68th percentile here&rdquo; tells you
            far more than a bare probability: it says whether you picked a
            genuinely extreme bar for this place, or an ordinary Tuesday.
          </p>
        </Section>

        <Section id="heat-index" eyebrow="Step 3" title="The heat index">
          <p>
            &ldquo;Very uncomfortable&rdquo; uses the{" "}
            <strong className="text-ink">NOAA/Rothfusz regression</strong>, the
            same polynomial the US National Weather Service publishes. Daily
            maximum temperature is converted to °F and combined with relative
            humidity:
          </p>
          <Formula>{`HI = -42.379 + 2.04901523·T + 10.14333127·RH
     - 0.22475541·T·RH - 0.00683783·T²
     - 0.05481717·RH² + 0.00122874·T²·RH
     + 0.00085282·T·RH² - 0.00000199·T²·RH²

T  = temperature (°F)
RH = relative humidity (%)`}</Formula>
          <p>
            The regression is only valid at or above 80 °F (26.7 °C); below that
            the NWS reports the dry-bulb temperature unchanged, and so do we. The
            result is converted back to °C.
          </p>
          <p className="text-ink-faint">
            Caveat worth knowing: POWER publishes a daily <em>maximum</em>{" "}
            temperature and a daily <em>mean</em> humidity. Pairing them is the
            standard approach for daily climatology, but humidity typically dips
            when temperature peaks — so this heat index runs slightly warm
            compared with an hourly calculation. Treat it as a consistent
            comparative index rather than a precise instantaneous reading.
          </p>
        </Section>

        <Section id="trend" eyebrow="Step 4" title="Climate trend regression">
          <p>
            Extreme-weather probabilities are not static, so a single 30-year
            average can hide a moving target. For each condition orbitWx computes
            that year&apos;s exceedance fraction inside the window, then fits a
            degree-1 least-squares line against year:
          </p>
          <Formula>{`fraction(year) ≈ slope · year + intercept
slope_per_decade = slope × 10`}</Formula>
          <p>
            Alongside the slope we report a plain-language comparison of the first
            decade (1996–2005) against the last (2016–2025) — for example,{" "}
            <em className="text-ink">
              &ldquo;Heavy-rain odds on this date rose from 18% (1996–2005) to 27%
              (2016–2025)&rdquo;
            </em>
            . Differences under 2 percentage points are reported as steady rather
            than dressed up as a trend.
          </p>
          <p className="text-ink-faint">
            A linear fit over 30 noisy annual points is a descriptive summary, not
            a significance test. Read it as direction and magnitude, not proof.
          </p>
        </Section>

        <Section id="limits" eyebrow="Honest limits" title="What this cannot do">
          <ul className="ml-4 list-disc space-y-2">
            <li>
              <strong className="text-ink">It is not a forecast.</strong> orbitWx
              cannot tell you whether it will rain on 15 October next year — only
              how often it has rained on that date historically.
            </li>
            <li>
              <strong className="text-ink">Grid, not point.</strong> A 0.5° ×
              0.625° cell is roughly 55 km × 60 km at the equator. Microclimates,
              valleys and coastlines inside a cell are averaged away.
            </li>
            <li>
              <strong className="text-ink">Reanalysis, not a rain gauge.</strong>{" "}
              MERRA-2 assimilates observations into a model. It is excellent for
              climatology and less exact than a co-located station for a single
              day.
            </li>
            <li>
              <strong className="text-ink">Stationarity is assumed.</strong> The
              headline probability treats all 30 years as one pool. The trend
              panel exists precisely because that assumption is imperfect.
            </li>
          </ul>
        </Section>
      </div>

      <Card className="mt-14 p-6">
        <h2 className="font-display text-lg font-semibold">
          Check the numbers yourself
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          Every result ships with a CSV/JSON export of the exact rows that fed
          the calculation, plus the POWER request URL that produced them. Nothing
          in orbitWx is a black box.
        </p>
        <Link
          href="/"
          className="mt-4 inline-flex text-sm text-accent hover:underline"
        >
          Run an analysis →
        </Link>
      </Card>
    </div>
  );
}
