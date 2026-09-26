import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer, useAnimations, useGLTF } from "@react-three/drei";
import { SkeletonUtils } from "three-stdlib";
import * as THREE from "three";
import { AnimatePresence, motion } from "framer-motion";
import yard from "@/assets/puppy-backyard.jpg";
import puppyAsset from "@/assets/puppy-dog-embedded.glb.asset.json";

export type PuppyMood = "happy" | "excited" | "curious" | "sleepy" | "hungry" | "sad";

const actionClip: Record<string, string> = {
  fetch: "run", tug: "gesture-negative", paw: "gesture-positive",
  belly: "dance", pat: "gesture-positive", nap: "idle", eat: "eat",
};

function PuppyModel({ mood, playing, turn }: { mood: PuppyMood; playing: string | null; turn: number }) {
  const { scene, animations } = useGLTF(puppyAsset.url);
  const dog = useMemo(() => {
    const clone = SkeletonUtils.clone(scene);
    const bounds = new THREE.Box3().setFromObject(clone);
    const size = bounds.getSize(new THREE.Vector3());
    clone.scale.setScalar(1.55 / Math.max(size.y, 0.01));
    const scaled = new THREE.Box3().setFromObject(clone);
    const center = scaled.getCenter(new THREE.Vector3());
    clone.position.set(-center.x, -scaled.min.y, -center.z);
    clone.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
        if (object.material instanceof THREE.MeshStandardMaterial) object.material.roughness = 0.82;
      }
    });
    return clone;
  }, [scene]);
  const body = useRef<THREE.Group>(null);
  const { actions } = useAnimations(animations, body);
  const clip = playing ? actionClip[playing] ?? "idle" : mood === "sleepy" ? "idle" : mood === "excited" ? "dance" : "idle";

  useEffect(() => {
    const active = actions[clip] ?? actions.idle;
    active?.reset().fadeIn(0.22).play();
    return () => { active?.fadeOut(0.22); };
  }, [actions, clip, playing]);

  useFrame(({ clock }, rawDelta) => {
    if (!body.current) return;
    const dt = Math.min(rawDelta, 0.05);
    const t = clock.elapsedTime;
    const fetch = playing === "fetch";
    const targetX = fetch ? Math.sin(t * 5) * 0.55 : 0;
    body.current.position.x = THREE.MathUtils.damp(body.current.position.x, targetX, fetch ? 9 : 4, dt);
    body.current.position.y = playing === "nap" ? -0.13 : Math.sin(t * (fetch ? 12 : 2.2)) * (fetch ? 0.045 : 0.015);
    body.current.rotation.y = THREE.MathUtils.damp(body.current.rotation.y, turn + (fetch ? Math.sin(t * 5) * 0.5 : Math.sin(t * 0.55) * 0.1), 5, dt);
    body.current.rotation.z = THREE.MathUtils.damp(body.current.rotation.z, playing === "belly" ? 0.23 : 0, 4, dt);
  });

  return <group ref={body} position={[0, 0, 0]}><primitive object={dog} /></group>;
}

function PuppyScene({ mood, playing, turn }: { mood: PuppyMood; playing: string | null; turn: number }) {
  return (
    <Canvas shadows dpr={[1, 1.7]} gl={{ alpha: true, antialias: true }} camera={{ position: [0, 1.8, 4.6], fov: 37 }} onCreated={({ camera }) => camera.lookAt(0, 0.8, 0)} style={{ background: "transparent" }}>
      <ambientLight intensity={0.85} />
      <directionalLight position={[-2, 5, 4]} intensity={2.2} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-3} shadow-camera-right={3} shadow-camera-top={3} shadow-camera-bottom={-3} />
      <Environment><Lightformer intensity={1.2} position={[2, 4, 1]} scale={[5, 3, 1]} /></Environment>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.03, 0]} receiveShadow>
        <planeGeometry args={[4, 4]} />
        <shadowMaterial transparent opacity={0.28} />
      </mesh>
      <Suspense fallback={null}><PuppyModel mood={mood} playing={playing} turn={turn} /></Suspense>
    </Canvas>
  );
}

export function PuppyYard({ name, mood, playing, onPat }: { name: string; mood: PuppyMood; playing: string | null; onPat: () => void }) {
  const [mounted, setMounted] = useState(false);
  const [turn, setTurn] = useState(0);
  const start = useRef<{ x: number; turn: number; moved: boolean } | null>(null);
  useEffect(() => { setMounted(true); }, []);

  return (
    <div className="relative isolate h-[390px] w-full overflow-hidden rounded-lg border border-border sm:h-[470px]" aria-label={`${name} in the backyard`}>
      <img src={yard} alt="Sunlit puppy backyard with a doghouse" width={1280} height={1024} className="absolute inset-0 size-full object-cover" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-background/15 to-transparent" />
      {mounted && <div className="pointer-events-none absolute inset-0 z-10" aria-hidden="true"><PuppyScene mood={mood} playing={playing} turn={turn} /></div>}
      <div className="pointer-events-none absolute left-4 top-4 z-20 rounded-md border border-border bg-background/85 px-3 py-2 text-sm font-semibold text-foreground backdrop-blur">
        {mood === "excited" ? "🐾 Zoomies!" : mood === "curious" ? "👀 Curious" : mood === "sleepy" ? "💤 Sleepy" : mood === "hungry" ? "🥣 Hungry" : mood === "sad" ? "💧 Misses you" : "💛 Happy"}
      </div>
      <button
        type="button"
        aria-label={`Pet or turn ${name}`}
        className="absolute bottom-[9%] left-[18%] z-20 h-[70%] w-[64%] cursor-grab touch-none rounded-md focus-visible:outline-2 focus-visible:outline-primary active:cursor-grabbing"
        onPointerDown={(event) => { start.current = { x: event.clientX, turn, moved: false }; event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerMove={(event) => {
          if (!start.current) return;
          const dx = event.clientX - start.current.x;
          if (Math.abs(dx) > 7) start.current.moved = true;
          if (start.current.moved) setTurn(THREE.MathUtils.clamp(start.current.turn + dx * 0.012, -Math.PI, Math.PI));
        }}
        onPointerUp={() => { if (start.current && !start.current.moved) onPat(); start.current = null; }}
        onPointerCancel={() => { start.current = null; }}
        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onPat(); } }}
      />
      <AnimatePresence>
        {playing === "fetch" && <motion.span aria-hidden="true" initial={{ x: -95, y: 10, opacity: 0 }} animate={{ x: [0, 90, 0], y: [10, -30, 10], opacity: [0, 1, 1] }} exit={{ opacity: 0 }} transition={{ duration: 1.8 }} className="pointer-events-none absolute bottom-[19%] left-1/2 z-20 text-4xl">🎾</motion.span>}
        {playing && <motion.div key={playing} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="pointer-events-none absolute bottom-3 left-1/2 z-30 -translate-x-1/2 rounded-md bg-background/80 px-4 py-2 text-sm font-semibold text-foreground backdrop-blur">{playing === "fetch" ? "Got it! 🎾" : playing === "tug" ? "Grr... mine! 🪢" : playing === "nap" ? "Sweet dreams... 💤" : playing === "belly" ? "More belly rubs! 💛" : playing === "paw" ? "Good dog! 🐾" : playing === "eat" ? "Yum! 🥣" : "Woof! 💛"}</motion.div>}
      </AnimatePresence>
    </div>
  );
}