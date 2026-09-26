import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Bone, Heart, ShoppingBag, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LuviesAmount } from "@/components/luvies/LuviesAmount";
import { useLuviesWallet } from "@/hooks/useLuvies";
import { PuppyYard, type PuppyMood } from "@/components/puppy/PuppyYard";
import { PUPPY_FOOD_BY_KEY, PUPPY_FOODS, fullnessNow, hoursSinceFed, STARVE_HOURS } from "@/lib/puppy-foods";
import { adoptPuppy, feedPuppy, getPuppy, playWithPuppy, renamePuppy, type Puppy } from "@/lib/puppy.functions";
import { puppySound } from "@/lib/puppy-sfx";

export const Route = createFileRoute("/_authenticated/app/puppy")({
  head: () => ({ meta: [
    { title: "Your Puppy — PANDACINE" },
    { name: "description", content: "Adopt a puppy, play in its backyard and care for it with puppy meals and treats." },
    { property: "og:title", content: "Your Puppy — PANDACINE" },
    { property: "og:description", content: "Adopt a puppy, play in its backyard and care for it with puppy meals and treats." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: PuppyPage,
});

function PuppyPage() {
  const qc = useQueryClient();
  const fetchPuppy = useServerFn(getPuppy);
  const adopt = useServerFn(adoptPuppy);
  const rename = useServerFn(renamePuppy);
  const feed = useServerFn(feedPuppy);
  const play = useServerFn(playWithPuppy);
  const { data, isLoading, error } = useQuery({ queryKey: ["puppy"], queryFn: () => fetchPuppy({ data: undefined as never }) });
  const puppy = data?.puppy as Puppy | null | undefined;
  const { data: wallet } = useLuviesWallet();
  const [name, setName] = useState("Biscuit");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const [moodOverride, setMoodOverride] = useState<PuppyMood | null>(null);
  useEffect(() => { if (puppy?.name) setName(puppy.name); }, [puppy?.name]);
  useEffect(() => { if (!playing) return; const timer = window.setTimeout(() => { setPlaying(null); setMoodOverride(null); }, 2100); return () => window.clearTimeout(timer); }, [playing]);
  const fullness = puppy ? fullnessNow(puppy.fullness, puppy.last_fed_at) : 100;
  const deceased = !!puppy?.unlocked && (!puppy.alive || hoursSinceFed(puppy.last_fed_at) >= STARVE_HOURS);
  const mood: PuppyMood = moodOverride ?? (deceased ? "sad" : fullness < 25 ? "hungry" : puppy && puppy.affection < 15 ? "curious" : "happy");
  const pantry = puppy?.pantry ?? {};
  const availableFood = Object.entries(pantry).filter(([key, qty]) => qty > 0 && PUPPY_FOOD_BY_KEY[key]);

  async function perform(action: string) {
    if (busy || deceased || !puppy?.unlocked) return;
    setBusy(true);
    setPlaying(action);
    setMoodOverride(action === "nap" ? "sleepy" : action === "pat" ? "happy" : "excited");
    puppySound(action === "nap" ? "sleep" : action === "pat" ? "bark" : "play");
    try { await play({ data: { action } }); await qc.invalidateQueries({ queryKey: ["puppy"] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't play right now"); }
    finally { setBusy(false); }
  }

  async function eat(key: string) {
    if (busy) return;
    setBusy(true);
    try {
      await feed({ data: { key } });
      puppySound("eat"); setPlaying("paw"); setMoodOverride("happy");
      await qc.invalidateQueries({ queryKey: ["puppy"] });
      toast.success(`${puppy?.name ?? "Puppy"} loved it!`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't feed your puppy"); }
    finally { setBusy(false); }
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-20 pt-5 text-foreground sm:px-8">
      <header className="mb-6 flex items-center justify-between gap-4">
        <Link to="/app/pet" aria-label="Back to pets" className="inline-flex size-10 items-center justify-center rounded-md border border-border bg-surface text-foreground"><ArrowLeft className="size-5" /></Link>
        <div className="text-center"><p className="text-xs uppercase text-muted-foreground">Your pets</p><h1 className="font-display text-3xl">Puppy backyard</h1></div>
        <span className="text-sm text-primary"><LuviesAmount value={wallet?.balance ?? 0} /></span>
      </header>
      {isLoading ? <div className="py-24 text-center text-muted-foreground">Opening the backyard…</div> : error ? <div className="py-24 text-center text-destructive">The backyard couldn't load. Please try again.</div> : !puppy?.unlocked ? (
        <section className="mx-auto max-w-2xl space-y-6">
          <PuppyYard name={name} mood="curious" playing={null} onPat={() => puppySound("bark")} />
          <div className="space-y-4 text-center"><p className="font-display text-2xl">A new friend is waiting.</p><label className="block text-sm text-muted-foreground" htmlFor="puppy-name">Name your puppy</label><input id="puppy-name" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} className="mx-auto block w-full max-w-xs rounded-md border border-border bg-surface px-4 py-3 text-center text-foreground" />
            <Button variant="petal" size="lg" disabled={busy || (wallet?.balance ?? 0) < (data?.cost ?? 250)} onClick={async () => { setBusy(true); try { await adopt({ data: { name } }); puppySound("bark"); await Promise.all([qc.invalidateQueries({ queryKey: ["puppy"] }), qc.invalidateQueries({ queryKey: ["luvies"] })]); toast.success("Your puppy is home!"); } catch (e) { toast.error(e instanceof Error ? e.message : "Adoption failed"); } finally { setBusy(false); } }}>Adopt puppy · {data?.cost ?? 250} Luvies</Button>
            {(wallet?.balance ?? 0) < (data?.cost ?? 250) && <p className="text-sm text-muted-foreground">You need more Luvies to adopt.</p>}
          </div>
        </section>
      ) : deceased ? (
        <section className="mx-auto max-w-lg space-y-5 py-16 text-center"><div className="text-6xl">🐾</div><h2 className="font-display text-3xl">Remembering {puppy.name}</h2><p className="text-muted-foreground">Your puppy's time in the backyard has come to an end. Thank you for all the love and play.</p><Link to="/app/pet" className="inline-block text-primary underline">Back to pets</Link></section>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(270px,1fr)]">
          <section className="min-w-0 space-y-5">
            <PuppyYard name={puppy.name} mood={mood} playing={playing} onPat={() => void perform("pat")} />
            <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs uppercase text-muted-foreground">Your companion</p>{editing ? <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { await rename({ data: { name } }); await qc.invalidateQueries({ queryKey: ["puppy"] }); setEditing(false); } catch (err) { toast.error(err instanceof Error ? err.message : "Couldn't rename puppy"); } finally { setBusy(false); } }}><input aria-label="Puppy name" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} className="w-36 rounded-md border border-border bg-surface px-2 text-foreground" /><Button size="sm" disabled={busy}>Save</Button></form> : <button onClick={() => setEditing(true)} className="font-display text-2xl text-foreground" title="Rename puppy">{puppy.name} ✎</button>}</div><span className="text-sm text-muted-foreground">{puppy.streak} day streak</span></div>
            <div className="grid grid-cols-2 gap-3"><Meter label="Fullness" value={fullness} icon="🥣" /><Meter label="Affection" value={puppy.affection} icon="💛" /></div>
            <p className="text-xs text-muted-foreground">{Math.max(0, Math.ceil(STARVE_HOURS - hoursSinceFed(puppy.last_fed_at)))} hours until your puppy needs a meal · {puppy.interactions} moments together</p>
          </section>
          <section className="min-w-0 space-y-8">
            <div><h2 className="mb-3 flex items-center gap-2 font-display text-xl"><Sparkles className="size-5 text-primary" /> Play together</h2><div className="grid grid-cols-2 gap-2">{([ ["fetch", "🎾", "Fetch"], ["tug", "🪢", "Tug of war"], ["paw", "🐾", "Shake paw"], ["belly", "💛", "Belly rub"], ["nap", "💤", "Nap"], ["pat", "✋", "Pet" ] ] as const).map(([action, emoji, label]) => <Button key={action} variant="quiet" className="h-14 justify-start gap-2 text-sm" disabled={busy} onClick={() => void perform(action)}><span className="text-lg">{emoji}</span>{label}</Button>)}</div></div>
            <div><div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 font-display text-xl"><Bone className="size-5 text-primary" /> Food bowl</h2><Link to="/app/mart" className="flex items-center gap-1 text-sm text-primary"><ShoppingBag className="size-4" /> Shop</Link></div>{availableFood.length ? <div className="space-y-2">{availableFood.map(([key, qty]) => { const food = PUPPY_FOOD_BY_KEY[key]; return <div key={key} className="flex items-center gap-3 border-b border-border py-2"><span className="text-2xl">{food.emoji}</span><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{food.name}</p><p className="text-xs text-muted-foreground">{qty} in bowl · +{food.fullness} fullness</p></div><Button variant="soft" size="sm" disabled={busy} onClick={() => void eat(key)}>Feed</Button></div>; })}</div> : <div className="space-y-3 border-t border-border pt-4"><p className="text-sm text-muted-foreground">Your puppy's bowl is empty.</p><Link to="/app/mart" className="inline-flex items-center gap-2 text-sm text-primary"><ShoppingBag className="size-4" /> Visit puppy meals</Link></div>}<p className="mt-4 text-xs text-muted-foreground">{PUPPY_FOODS.length} puppy-safe meals and treats in the supermarket.</p></div>
            <div className="flex items-start gap-2 border-t border-border pt-4 text-xs text-muted-foreground"><Heart className="size-4 shrink-0 text-primary" /> Your panda is still waiting in its own home. Puppy care is separate.</div>
          </section>
        </div>
      )}
    </main>
  );
}

function Meter({ label, value, icon }: { label: string; value: number; icon: string }) {
  return <div className="border-t border-border pt-3"><div className="flex justify-between text-sm"><span>{icon} {label}</span><span>{Math.round(value)}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div></div>;
}