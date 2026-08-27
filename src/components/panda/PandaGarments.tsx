import { useEffect, useRef } from "react";
import { motion, useMotionValue, type MotionValue } from "framer-motion";

/**
 * Real, hand-drawn SVG wardrobe for the mascot — no emoji.
 *
 * Everything here is authored in the PandaCharacter coordinate space
 * (viewBox 0 0 300 380): head centre (150,140), ears (150±64, 78),
 * eyes (150±34, 134), torso ellipse (150,252) r(86,80).
 *
 * Dangling parts (drawstrings, hat pom, bow tails, ties, cables) are driven by
 * a small damped-spring pendulum so cloth actually lags, overshoots and settles
 * instead of looping a canned keyframe.
 */

/* ------------------------------------------------------------------ *
 * Cloth physics — damped spring pendulum with breathing drive + gusts
 * ------------------------------------------------------------------ */
export function useSway(
  { amp = 8, freq = 0.55, stiffness = 26, damping = 3.2, energy = 1, enabled = true } = {},
): MotionValue<number> {
  const mv = useMotionValue(0);
  const cfg = useRef({ amp, freq, stiffness, damping, energy });
  cfg.current = { amp, freq, stiffness, damping, energy };

  useEffect(() => {
    if (!enabled) {
      mv.set(0);
      return;
    }
    let raf = 0;
    let angle = 0;
    let vel = 0;
    let t = Math.random() * 10;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.045, Math.max(0.001, (now - last) / 1000));
      last = now;
      const c = cfg.current;
      t += dt;
      // driving force: gentle breathing motion + turbulent micro-gusts
      const drive =
        Math.sin(t * c.freq * Math.PI * 2) * c.amp * c.energy +
        Math.sin(t * c.freq * 5.3 + 1.7) * c.amp * 0.18 * c.energy;
      const acc = (drive - angle) * c.stiffness - vel * c.damping;
      vel += acc * dt;
      angle += vel * dt;
      mv.set(Number.isFinite(angle) ? angle : 0);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [enabled, mv]);

  return mv;
}

function Dangle({
  origin,
  children,
  amp = 9,
  freq = 0.5,
  energy = 1,
  enabled = true,
}: {
  origin: [number, number];
  children: React.ReactNode;
  amp?: number;
  freq?: number;
  energy?: number;
  enabled?: boolean;
}) {
  const rotate = useSway({ amp, freq, energy, enabled });
  return (
    <motion.g style={{ rotate, transformOrigin: `${origin[0]}px ${origin[1]}px` }} pointerEvents="none">
      {children}
    </motion.g>
  );
}

/* ------------------------------------------------------------------ *
 * Shared cloth geometry
 * ------------------------------------------------------------------ */
/** Cloth that hugs the torso barrel, shoulders to hem. */
const TORSO = "M 70 208 q 22 -30 80 -30 q 58 0 80 30 q 14 44 3 76 q -36 24 -83 24 q -47 0 -83 -24 q -11 -32 3 -76 z";
/** Short sleeve caps over both forelegs. */
const SLEEVE_L = "M 74 210 q -18 8 -22 34 q 12 12 30 10 q -4 -26 -8 -44 z";
const SLEEVE_R = "M 226 210 q 18 8 22 34 q -12 12 -30 10 q 4 -26 8 -44 z";

function ClothDefs() {
  return (
    <defs>
      <linearGradient id="gRose" x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0%" stopColor="#ffc4d8" />
        <stop offset="55%" stopColor="#f08bb0" />
        <stop offset="100%" stopColor="#b95c86" />
      </linearGradient>
      <linearGradient id="gCloud" x1="0" y1="0" x2="0.2" y2="1">
        <stop offset="0%" stopColor="#e8f2ff" />
        <stop offset="60%" stopColor="#bcd4f2" />
        <stop offset="100%" stopColor="#8fa8cd" />
      </linearGradient>
      <linearGradient id="gKnit" x1="0" y1="0" x2="0.25" y2="1">
        <stop offset="0%" stopColor="#f6e6cf" />
        <stop offset="60%" stopColor="#dcc09b" />
        <stop offset="100%" stopColor="#a98a67" />
      </linearGradient>
      <linearGradient id="gTee" x1="0" y1="0" x2="0.2" y2="1">
        <stop offset="0%" stopColor="#fdfdfd" />
        <stop offset="60%" stopColor="#e6e3ea" />
        <stop offset="100%" stopColor="#bab5c4" />
      </linearGradient>
      <linearGradient id="gLeather" x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0%" stopColor="#4b4655" />
        <stop offset="45%" stopColor="#221f2b" />
        <stop offset="100%" stopColor="#0f0d15" />
      </linearGradient>
      <linearGradient id="gSanta" x1="0" y1="0" x2="0.25" y2="1">
        <stop offset="0%" stopColor="#ef5f6b" />
        <stop offset="55%" stopColor="#c92f43" />
        <stop offset="100%" stopColor="#8a1526" />
      </linearGradient>
      <linearGradient id="gGold" x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0%" stopColor="#f8e3a6" />
        <stop offset="45%" stopColor="#d7ab4c" />
        <stop offset="100%" stopColor="#8d6a1f" />
      </linearGradient>
      <linearGradient id="gSheen" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#ffffff" stopOpacity=".5" />
        <stop offset="55%" stopColor="#ffffff" stopOpacity="0" />
      </linearGradient>
      <filter id="clothShade" x="-25%" y="-25%" width="150%" height="150%">
        <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#120f18" floodOpacity=".35" />
      </filter>
    </defs>
  );
}

function Folds({ opacity = 0.22 }: { opacity?: number }) {
  return (
    <g stroke="#000" strokeOpacity={opacity} strokeWidth="1.6" fill="none" strokeLinecap="round">
      <path d="M 104 232 q 8 30 2 62" />
      <path d="M 150 226 q -4 34 0 66" />
      <path d="M 196 232 q -8 30 -2 62" />
      <path d="M 84 250 q 14 10 20 26" />
      <path d="M 216 250 q -14 10 -20 26" />
    </g>
  );
}

/* ------------------------------------------------------------------ *
 * Outfits (torso layer — drawn above the body, below the forelegs)
 * ------------------------------------------------------------------ */
export function PandaOutfit({ itemKey, energy = 1 }: { itemKey?: string | null; energy?: number }) {
  if (!itemKey) return null;
  const lite = energy < 0.05;

  const common = (
    <>
      <ClothDefs />
    </>
  );

  switch (itemKey) {
    case "hoodie-pink":
      return (
        <g pointerEvents="none" filter="url(#clothShade)">
          {common}
          {/* hood slumped behind the neck */}
          <path d="M 92 200 q 58 -46 116 0 q -10 22 -58 24 q -48 -2 -58 -24 z" fill="#c76d94" />
          <path d={TORSO} fill="url(#gRose)" />
          <path d={SLEEVE_L} fill="url(#gRose)" />
          <path d={SLEEVE_R} fill="url(#gRose)" />
          <path d={TORSO} fill="url(#gSheen)" opacity=".35" />
          {/* kangaroo pocket */}
          <path d="M 112 272 q 38 12 76 0 l -6 30 q -32 8 -64 0 z" fill="#000" fillOpacity=".13" />
          {/* neck rib */}
          <path d="M 118 202 q 32 22 64 0" stroke="#8f4468" strokeWidth="7" fill="none" strokeLinecap="round" />
          <Folds />
          {/* physical drawstrings */}
          <Dangle origin={[132, 206]} amp={11} freq={0.45} energy={energy} enabled={!lite}>
            <path d="M 132 206 q -3 22 2 38" stroke="#fdf0f5" strokeWidth="3.4" fill="none" strokeLinecap="round" />
            <circle cx="134" cy="246" r="3.6" fill="#fdf0f5" />
          </Dangle>
          <Dangle origin={[168, 206]} amp={9} freq={0.62} energy={energy} enabled={!lite}>
            <path d="M 168 206 q 4 20 -1 34" stroke="#fdf0f5" strokeWidth="3.4" fill="none" strokeLinecap="round" />
            <circle cx="167" cy="242" r="3.6" fill="#fdf0f5" />
          </Dangle>
        </g>
      );

    case "pajamas-cloud":
      return (
        <g pointerEvents="none" filter="url(#clothShade)">
          {common}
          <path d={TORSO} fill="url(#gCloud)" />
          <path d={SLEEVE_L} fill="url(#gCloud)" />
          <path d={SLEEVE_R} fill="url(#gCloud)" />
          <path d={TORSO} fill="url(#gSheen)" opacity=".3" />
          {/* collar */}
          <path d="M 122 194 l 28 22 l 28 -22 q -28 -14 -56 0 z" fill="#f3f8ff" />
          {/* button placket */}
          <path d="M 150 216 L 150 300" stroke="#7f95b8" strokeWidth="2" opacity=".6" />
          {[232, 254, 276, 296].map((y) => (
            <circle key={y} cx="150" cy={y} r="3.4" fill="#fdfefe" stroke="#8ea6c8" strokeWidth="1" />
          ))}
          {/* cloud print */}
          {[
            [112, 240],
            [190, 252],
            [126, 288],
            [196, 292],
          ].map(([x, y]) => (
            <g key={`${x}-${y}`} fill="#ffffff" opacity=".85">
              <ellipse cx={x} cy={y} rx="11" ry="6" />
              <circle cx={x - 5} cy={y - 3} r="5" />
              <circle cx={x + 4} cy={y - 4} r="6" />
            </g>
          ))}
          <Folds opacity={0.14} />
        </g>
      );

    case "sweater-cable":
      return (
        <g pointerEvents="none" filter="url(#clothShade)">
          {common}
          <path d={TORSO} fill="url(#gKnit)" />
          <path d={SLEEVE_L} fill="url(#gKnit)" />
          <path d={SLEEVE_R} fill="url(#gKnit)" />
          {/* knit ribbing on the collar and hem */}
          <path d="M 116 196 q 34 26 68 0 q -6 16 -34 18 q -28 -2 -34 -18 z" fill="#c9a97f" />
          <path d="M 70 292 q 80 30 160 0 l 2 14 q -82 30 -164 0 z" fill="#c9a97f" />
          {/* cable braids */}
          {[124, 150, 176].map((x) => (
            <g key={x} stroke="#b9945f" strokeWidth="3" fill="none" opacity=".85" strokeLinecap="round">
              {[0, 1, 2, 3].map((i) => (
                <g key={i}>
                  <path d={`M ${x - 8} ${222 + i * 20} q 8 10 16 0`} />
                  <path d={`M ${x - 8} ${232 + i * 20} q 8 -10 16 0`} />
                </g>
              ))}
            </g>
          ))}
          {/* knit grain */}
          <g stroke="#a9855a" strokeWidth=".7" opacity=".35">
            {Array.from({ length: 14 }).map((_, i) => (
              <path key={i} d={`M 76 ${216 + i * 7} q 74 12 148 0`} fill="none" />
            ))}
          </g>
        </g>
      );

    case "tshirt-panda":
      return (
        <g pointerEvents="none" filter="url(#clothShade)">
          {common}
          <path d={TORSO} fill="url(#gTee)" />
          <path d={SLEEVE_L} fill="url(#gTee)" />
          <path d={SLEEVE_R} fill="url(#gTee)" />
          <path d="M 124 196 q 26 22 52 0 q -26 12 -52 0 z" fill="#cfc9d6" />
          {/* tiny panda print */}
          <g transform="translate(150 258) scale(1)">
            <circle cx="0" cy="0" r="26" fill="#fbf7f2" stroke="#2a2433" strokeWidth="2" />
            <circle cx="-19" cy="-19" r="8" fill="#2a2433" />
            <circle cx="19" cy="-19" r="8" fill="#2a2433" />
            <ellipse cx="-9" cy="-2" rx="7" ry="9" fill="#2a2433" transform="rotate(-16 -9 -2)" />
            <ellipse cx="9" cy="-2" rx="7" ry="9" fill="#2a2433" transform="rotate(16 9 -2)" />
            <circle cx="-9" cy="-1" r="2.6" fill="#fff" />
            <circle cx="9" cy="-1" r="2.6" fill="#fff" />
            <ellipse cx="0" cy="12" rx="5" ry="3.6" fill="#2a2433" />
          </g>
          <Folds opacity={0.12} />
        </g>
      );

    case "jacket-leather":
      return (
        <g pointerEvents="none" filter="url(#clothShade)">
          {common}
          <path d={TORSO} fill="url(#gLeather)" />
          <path d={SLEEVE_L} fill="url(#gLeather)" />
          <path d={SLEEVE_R} fill="url(#gLeather)" />
          <path d={TORSO} fill="url(#gSheen)" opacity=".28" />
          {/* open front showing chest fur */}
          <path d="M 150 200 q -16 52 -6 116 q -22 -6 -34 -16 q 8 -60 22 -100 z" fill="#0d0b12" opacity=".9" />
          <path d="M 150 200 q 16 52 6 116 q 22 -6 34 -16 q -8 -60 -22 -100 z" fill="#0d0b12" opacity=".9" />
          {/* collar / lapels */}
          <path d="M 122 192 q 20 22 28 34 q -30 6 -44 -10 q 4 -18 16 -24 z" fill="#3a3543" />
          <path d="M 178 192 q -20 22 -28 34 q 30 6 44 -10 q -4 -18 -16 -24 z" fill="#3a3543" />
          {/* zipper */}
          <path d="M 150 230 L 150 314" stroke="#cbb37c" strokeWidth="2.6" strokeDasharray="3 3" />
          {/* studs */}
          <g fill="#cbb37c" opacity=".9">
            <circle cx="112" cy="252" r="2.6" />
            <circle cx="188" cy="252" r="2.6" />
          </g>
          <Folds opacity={0.3} />
        </g>
      );

    case "outfit-santa":
      return (
        <g pointerEvents="none" filter="url(#clothShade)">
          {common}
          <path d={TORSO} fill="url(#gSanta)" />
          <path d={SLEEVE_L} fill="url(#gSanta)" />
          <path d={SLEEVE_R} fill="url(#gSanta)" />
          <path d={TORSO} fill="url(#gSheen)" opacity=".22" />
          {/* fur trim collar + hem + cuffs */}
          <path d="M 112 194 q 38 30 76 0 q -6 22 -38 26 q -32 -4 -38 -26 z" fill="#fdfbf7" />
          <path d="M 70 290 q 80 32 160 0 l 3 16 q -82 32 -166 0 z" fill="#fdfbf7" />
          <ellipse cx="70" cy="250" rx="12" ry="9" fill="#fdfbf7" />
          <ellipse cx="230" cy="250" rx="12" ry="9" fill="#fdfbf7" />
          {/* belt + buckle */}
          <path d="M 72 262 q 78 22 156 0 l 0 20 q -78 22 -156 0 z" fill="#1b1721" />
          <rect x="136" y="262" width="28" height="24" rx="5" fill="url(#gGold)" stroke="#8d6a1f" strokeWidth="1.6" />
          <rect x="144" y="270" width="12" height="8" rx="2" fill="#8a1526" opacity=".5" />
          <Folds opacity={0.18} />
        </g>
      );

    case "suit-tycoon":
      return (
        <g pointerEvents="none" filter="url(#clothShade)">
          {common}
          <path d={TORSO} fill="url(#gGold)" />
          <path d={SLEEVE_L} fill="url(#gGold)" />
          <path d={SLEEVE_R} fill="url(#gGold)" />
          {/* pinstripes */}
          <g stroke="#fff6d8" strokeWidth="1" opacity=".45">
            {Array.from({ length: 11 }).map((_, i) => (
              <path key={i} d={`M ${82 + i * 14} 200 L ${76 + i * 14} 316`} />
            ))}
          </g>
          {/* shirt V */}
          <path d="M 128 194 q 22 40 22 44 q 0 -4 22 -44 q -22 -10 -44 0 z" fill="#fffdf6" />
          {/* lapels */}
          <path d="M 126 192 q 20 26 24 46 q -32 4 -44 -14 q 6 -22 20 -32 z" fill="#c79c3c" />
          <path d="M 174 192 q -20 26 -24 46 q 32 4 44 -14 q -6 -22 -20 -32 z" fill="#c79c3c" />
          <path d={TORSO} fill="url(#gSheen)" opacity=".3" />
          {/* pocket square */}
          <path d="M 186 244 l 16 -4 l 2 10 l -16 4 z" fill="#f6dce6" />
          {/* physical silk tie */}
          <Dangle origin={[150, 214]} amp={7} freq={0.42} energy={energy} enabled={!lite}>
            <path d="M 144 212 l 12 0 l 4 10 l -10 8 l -10 -8 z" fill="#8f2c48" />
            <path d="M 150 230 l 11 10 l -11 52 l -11 -52 z" fill="#a63354" />
            <path d="M 150 230 l 5 6 l -5 46 z" fill="#c8577a" opacity=".6" />
          </Dangle>
        </g>
      );

    default:
      return null;
  }
}

/* ------------------------------------------------------------------ *
 * Head gear (drawn inside the head group so it tilts with the head)
 * ------------------------------------------------------------------ */
export function PandaHeadwear({
  itemKey,
  outfitKey,
  energy = 1,
}: {
  itemKey?: string | null;
  outfitKey?: string | null;
  energy?: number;
}) {
  const lite = energy < 0.05;
  const santaHat = outfitKey === "outfit-santa" && itemKey !== "crown-golden";

  return (
    <g pointerEvents="none">
      <ClothDefs />

      {santaHat && (
        <g>
          <path d="M 88 74 q 62 -66 124 -2 q -62 22 -124 2 z" fill="url(#gSanta)" />
          <path d="M 84 70 q 66 26 132 2 l 4 20 q -70 26 -140 -2 z" fill="#fdfbf7" />
          <Dangle origin={[204, 40]} amp={13} freq={0.4} energy={energy} enabled={!lite}>
            <path d="M 200 44 q 34 -12 42 20" stroke="#c92f43" strokeWidth="12" fill="none" strokeLinecap="round" />
            <circle cx="246" cy="68" r="12" fill="#fdfbf7" />
          </Dangle>
        </g>
      )}

      {itemKey === "hat-beanie" && (
        <g>
          <path d="M 82 82 q 68 -74 136 0 q -68 24 -136 0 z" fill="#7b5fa8" />
          <g stroke="#5f4784" strokeWidth="1.6" opacity=".7">
            {Array.from({ length: 8 }).map((_, i) => (
              <path key={i} d={`M ${94 + i * 16} 74 q 2 -22 6 -30`} fill="none" />
            ))}
          </g>
          <path d="M 78 76 q 72 30 144 0 l 3 20 q -74 30 -150 0 z" fill="#9e83c9" />
          <Dangle origin={[150, 28]} amp={10} freq={0.5} energy={energy} enabled={!lite}>
            <circle cx="150" cy="20" r="14" fill="#e3d6f5" />
            <circle cx="146" cy="16" r="5" fill="#fff" opacity=".6" />
          </Dangle>
        </g>
      )}

      {itemKey === "cap-cinema" && (
        <g>
          <path d="M 86 78 q 64 -70 128 -2 q -64 22 -128 2 z" fill="#1f2b3d" />
          <path d="M 210 72 q 44 6 46 26 q -46 10 -52 -12 z" fill="#16202f" />
          <circle cx="150" cy="20" r="5" fill="#3c4d69" />
          <g transform="translate(150 56)">
            <rect x="-16" y="-10" width="32" height="20" rx="3" fill="#f4efe8" />
            <g fill="#1f2b3d">
              <rect x="-16" y="-10" width="8" height="6" transform="rotate(-12 -12 -7)" />
              <rect x="0" y="-10" width="8" height="6" transform="rotate(-12 4 -7)" />
            </g>
          </g>
        </g>
      )}

      {itemKey === "crown-golden" && (
        <g>
          <path d="M 96 78 L 108 34 L 126 62 L 150 24 L 174 62 L 192 34 L 204 78 q -54 18 -108 0 z" fill="url(#gGold)" stroke="#8d6a1f" strokeWidth="2" />
          <path d="M 96 76 q 54 20 108 0 l 3 14 q -56 22 -114 0 z" fill="#c79c3c" />
          <circle cx="150" cy="82" r="5" fill="#e5507f" />
          <circle cx="118" cy="82" r="3.6" fill="#57c2c9" />
          <circle cx="182" cy="82" r="3.6" fill="#57c2c9" />
          <circle cx="150" cy="24" r="4" fill="#fff4cf" />
        </g>
      )}

      {itemKey === "glasses-round" && (
        <g>
          <circle cx="116" cy="134" r="26" fill="#cfe3f0" fillOpacity=".22" stroke="#d9c184" strokeWidth="3.4" />
          <circle cx="184" cy="134" r="26" fill="#cfe3f0" fillOpacity=".22" stroke="#d9c184" strokeWidth="3.4" />
          <path d="M 142 132 q 8 -6 16 0" stroke="#d9c184" strokeWidth="3.4" fill="none" />
          <path d="M 90 130 q -16 -4 -22 6" stroke="#d9c184" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M 210 130 q 16 -4 22 6" stroke="#d9c184" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M 104 122 q 12 -8 24 -2" stroke="#fff" strokeWidth="3" opacity=".5" fill="none" strokeLinecap="round" />
          <path d="M 172 122 q 12 -8 24 -2" stroke="#fff" strokeWidth="3" opacity=".5" fill="none" strokeLinecap="round" />
        </g>
      )}

      {itemKey === "headphones-rose" && (
        <g>
          <path d="M 72 118 q 78 -92 156 0" stroke="#e08bab" strokeWidth="13" fill="none" strokeLinecap="round" />
          <path d="M 72 118 q 78 -92 156 0" stroke="#fbd7e4" strokeWidth="5" fill="none" strokeLinecap="round" opacity=".7" />
          <g>
            <rect x="56" y="98" width="30" height="46" rx="14" fill="#c96d92" />
            <rect x="61" y="104" width="20" height="34" rx="10" fill="#f6c3d6" />
            <rect x="214" y="98" width="30" height="46" rx="14" fill="#c96d92" />
            <rect x="219" y="104" width="20" height="34" rx="10" fill="#f6c3d6" />
          </g>
          {/* physical cable */}
          <Dangle origin={[70, 142]} amp={7} freq={0.36} energy={energy} enabled={!lite}>
            <path d="M 70 142 q -14 40 6 76" stroke="#c96d92" strokeWidth="3.4" fill="none" strokeLinecap="round" />
          </Dangle>
        </g>
      )}

      {itemKey === "bow-ribbon" && (
        <g transform="translate(96 62)">
          <path d="M 0 0 q -26 -18 -30 4 q -4 20 30 10 z" fill="url(#gRose)" />
          <path d="M 0 0 q 26 -18 30 4 q 4 20 -30 10 z" fill="url(#gRose)" />
          <circle cx="0" cy="6" r="7" fill="#fbd7e4" />
          <Dangle origin={[0, 10]} amp={12} freq={0.55} energy={energy} enabled={!lite}>
            <path d="M -4 10 q -14 22 -4 36 l 10 -8 l 6 8 q 8 -20 -4 -36 z" fill="#e0779f" />
          </Dangle>
        </g>
      )}
    </g>
  );
}

/* ------------------------------------------------------------------ *
 * Props — held beside the right paw, with pendulum weight
 * ------------------------------------------------------------------ */
export function PandaProp({ itemKey, energy = 1 }: { itemKey?: string | null; energy?: number }) {
  if (!itemKey) return null;
  const lite = energy < 0.05;

  const body = (() => {
    switch (itemKey) {
      case "prop-backpack":
        return (
          <g>
            <rect x="-22" y="-20" width="44" height="50" rx="12" fill="#7c6bb0" />
            <rect x="-22" y="-4" width="44" height="16" rx="6" fill="#5d4f8c" />
            <rect x="-11" y="12" width="22" height="14" rx="5" fill="#e2d9f5" />
            <path d="M -14 -20 q 14 -14 28 0" stroke="#5d4f8c" strokeWidth="5" fill="none" />
          </g>
        );
      case "prop-plushie":
        return (
          <g>
            <circle cx="0" cy="4" r="20" fill="#f6efe6" />
            <circle cx="0" cy="-16" r="15" fill="#f6efe6" />
            <circle cx="-12" cy="-26" r="6" fill="#2a2433" />
            <circle cx="12" cy="-26" r="6" fill="#2a2433" />
            <ellipse cx="-6" cy="-17" rx="4.4" ry="5.4" fill="#2a2433" />
            <ellipse cx="6" cy="-17" rx="4.4" ry="5.4" fill="#2a2433" />
            <ellipse cx="0" cy="-8" rx="3.4" ry="2.4" fill="#2a2433" />
            <ellipse cx="-15" cy="10" rx="7" ry="10" fill="#2a2433" transform="rotate(20 -15 10)" />
            <ellipse cx="15" cy="10" rx="7" ry="10" fill="#2a2433" transform="rotate(-20 15 10)" />
          </g>
        );
      case "prop-flowers":
        return (
          <g>
            <path d="M 0 30 q -4 -20 -2 -34" stroke="#4f7c46" strokeWidth="4" fill="none" strokeLinecap="round" />
            <path d="M 0 26 q -12 -14 -14 -24" stroke="#4f7c46" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d="M 0 26 q 12 -14 14 -24" stroke="#4f7c46" strokeWidth="3" fill="none" strokeLinecap="round" />
            {[
              [-14, -26],
              [0, -36],
              [14, -26],
            ].map(([x, y]) => (
              <g key={`${x}`}>
                <circle cx={x} cy={y} r="9" fill="#e0567f" />
                <circle cx={x} cy={y} r="4.5" fill="#f7a6be" />
              </g>
            ))}
            <path d="M -12 24 q 12 10 24 0 l 2 12 q -14 8 -28 0 z" fill="#f3e2d4" />
          </g>
        );
      case "prop-phone":
        return (
          <g>
            <rect x="-15" y="-26" width="30" height="52" rx="7" fill="#1c1a24" />
            <rect x="-11" y="-21" width="22" height="42" rx="4" fill="#8fd0e8" />
            <circle cx="0" cy="-23" r="1.6" fill="#5c5a68" />
            <path d="M -6 -6 q 6 -10 12 0 q 6 10 -6 14 q -12 -4 -6 -14 z" fill="#e0567f" />
          </g>
        );
      case "prop-book":
        return (
          <g>
            <path d="M -24 -18 q 24 -8 24 4 q 0 -12 24 -4 l 0 34 q -24 -8 -24 4 q 0 -12 -24 -4 z" fill="#b3452f" />
            <path d="M -21 -14 q 20 -6 20 4 l 0 28 q 0 -10 -20 -4 z" fill="#fdf6ea" />
            <path d="M 21 -14 q -20 -6 -20 4 l 0 28 q 0 -10 20 -4 z" fill="#f4ead9" />
          </g>
        );
      case "prop-guitar":
        return (
          <g>
            <path d="M 0 34 m -18 0 a 18 20 0 1 0 36 0 a 18 20 0 1 0 -36 0" fill="#c07a37" />
            <path d="M 0 10 m -13 0 a 13 15 0 1 0 26 0 a 13 15 0 1 0 -26 0" fill="#c07a37" />
            <circle cx="0" cy="26" r="7" fill="#3b2312" />
            <rect x="-4" y="-40" width="8" height="46" rx="3" fill="#6b4423" />
            <rect x="-7" y="-48" width="14" height="10" rx="3" fill="#3b2312" />
            <g stroke="#f2e6cf" strokeWidth=".8" opacity=".8">
              <path d="M -2 -40 L -2 34" />
              <path d="M 2 -40 L 2 34" />
            </g>
          </g>
        );
      default:
        return null;
    }
  })();

  if (!body) return null;

  return (
    <Dangle origin={[236, 248]} amp={6} freq={0.38} energy={energy} enabled={!lite}>
      <g transform="translate(236 272)">{body}</g>
    </Dangle>
  );
}
