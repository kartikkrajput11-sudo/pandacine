import coin from "@/assets/luvie-coin.png";
import { formatLuvies } from "@/lib/luvies";

/** The Luvies coin mark — used anywhere a balance or price is shown. */
export function LuvieCoin({ className = "size-4" }: { className?: string }) {
  return (
    <img
      src={coin}
      alt=""
      aria-hidden
      loading="lazy"
      width={816}
      height={816}
      className={`${className} object-contain drop-shadow-[0_1px_4px_rgba(255,140,170,0.35)]`}
    />
  );
}

export function LuviesAmount({
  value,
  size = "md",
  suffix = false,
  className = "",
}: {
  value: number | null | undefined;
  size?: "sm" | "md" | "lg" | "xl";
  suffix?: boolean;
  className?: string;
}) {
  const coinSize = size === "xl" ? "size-7" : size === "lg" ? "size-5" : size === "sm" ? "size-3.5" : "size-4";
  const text =
    size === "xl"
      ? "text-3xl font-semibold"
      : size === "lg"
        ? "text-lg font-semibold"
        : size === "sm"
          ? "text-xs font-medium"
          : "text-sm font-semibold";
  return (
    <span className={`inline-flex items-center gap-1.5 tabular-nums text-petal ${text} ${className}`}>
      <LuvieCoin className={coinSize} />
      {formatLuvies(value)}
      {suffix && <span className="text-candle-muted font-normal">Luvies</span>}
    </span>
  );
}
