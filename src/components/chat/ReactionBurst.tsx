import { useEffect, useMemo, useState } from "react";

type Kind = "hearts" | "sparkles" | "petals" | "embers";

const THEME_KIND: Record<string, Kind> = {
  velvet: "hearts",
  romance: "hearts",
  photo: "hearts",
  sakura: "petals",
  sunset: "embers",
  gilded: "sparkles",
  midnight: "sparkles",
  ocean: "sparkles",
  forest: "petals",
  mono: "sparkles",
};

function kindForTheme(theme?: string | null): Kind {
  return THEME_KIND[theme ?? ""] ?? "hearts";
}

const Glyph = ({ kind }: { kind: Kind }) => {
  if (kind === "hearts")
    return (
      <svg viewBox="0 0 24 24" className="size-full">
        <path
          d="M12 21s-7.5-4.7-9.5-9C1.1 8.6 3 5.5 6.2 5.5c1.9 0 3.2 1 3.8 2.2.6-1.2 1.9-2.2 3.8-2.2 3.2 0 5.1 3.1 3.7 6.5-2 4.3-9.5 9-9.5 9z"
          fill="currentColor"
        />
      </svg>
    );
  if (kind === "petals")
    return (
      <svg viewBox="0 0 24 24" className="size-full">
        <path d="M12 2c4 4.5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6.5 6-11z" fill="currentColor" />
      </svg>
    );
  if (kind === "embers")
    return (
      <svg viewBox="0 0 24 24" className="size-full">
        <circle cx="12" cy="12" r="7" fill="currentColor" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" className="size-full">
      <path d="M12 1.5l2.2 6.6 6.8 2.2-6.8 2.2L12 22.5l-2.2-10 -6.8-2.2 6.8-2.2z" fill="currentColor" />
    </svg>
  );
};

/**
 * Luxurious per-theme reaction bloom. Rendered inside the tapped message only,
 * so the animation stays local to that bubble.
 */
export function ReactionBurst({
  trigger,
  theme,
  mine,
}: {
  trigger: number;
  theme?: string | null;
  mine?: boolean;
}) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!trigger) return;
    setActive(true);
    const t = window.setTimeout(() => setActive(false), 1500);
    return () => window.clearTimeout(t);
  }, [trigger]);

  const kind = kindForTheme(theme);
  const bits = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => {
        const angle = -90 + (i - 4.5) * 15 + ((i * 37) % 11) - 5;
        const dist = 34 + ((i * 29) % 34);
        const rad = (angle * Math.PI) / 180;
        return {
          x: Math.cos(rad) * dist,
          y: Math.sin(rad) * dist,
          size: 8 + ((i * 13) % 9),
          delay: (i % 5) * 45,
          spin: ((i % 3) - 1) * 40,
        };
      }),
    [trigger],
  );

  if (!active) return null;

  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 z-20 overflow-visible"
      style={{ color: "var(--petal, #f0a5bd)" }}
    >
      <span
        className="reaction-halo absolute rounded-full"
        style={{ [mine ? "right" : "left"]: "16%", bottom: "10%" }}
      />
      {bits.map((b, i) => (
        <span
          key={`${trigger}-${i}`}
          className="reaction-bit absolute"
          style={{
            [mine ? "right" : "left"]: "16%",
            bottom: "10%",
            width: b.size,
            height: b.size,
            animationDelay: `${b.delay}ms`,
            ["--rx" as any]: `${mine ? -b.x : b.x}px`,
            ["--ry" as any]: `${b.y}px`,
            ["--rr" as any]: `${b.spin}deg`,
          }}
        >
          <Glyph kind={kind} />
        </span>
      ))}
    </span>
  );
}
