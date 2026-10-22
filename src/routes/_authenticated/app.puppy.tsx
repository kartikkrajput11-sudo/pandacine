import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Bone, Heart, ShoppingBag, Sparkles, Pencil, PawPrint, CircleDot, Hand, Moon, Activity, Flame } from "lucide-react";
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
      puppySound("eat"); setPlaying("eat"); setMoodOverride("happy");
      await qc.invalidateQueries({ queryKey: ["puppy"] });
      toast.success(`${puppy?.name ?? "Puppy"} loved it!`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't feed your puppy"); }
    finally { setBusy(false); }
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-20 pt-5 text-foreground sm:px-8">
      <header className="mb-6 flex items-center justify-between gap-4">
        <Link to="/app/pet" aria-label="Back to pets" className="inline-flex size-10 items-center justify-center rounded-md border border-border bg-surface text-foreground"><ArrowLeft className="size-5" /></Link>
        <div className="text-center"><p className="text-xs uppercase text-muted-foreground">Your pets</p><h1 className="font-display text-3xl">Puppy backyard</h1></div>
        <span className="text-sm text-primary"><LuviesAmount value={wallet?.balance ?? 0} /></span>
      </header>
      {isLoading ? <div className="py-24 text-center text-muted-foreground">Opening the backyard…</div> : error ? <div className="py-24 text-center text-destructive">The backyard couldn't load. Please try again.</div> : !puppy?.unlocked ? (
        <section className="mx-auto mt-12 max-w-sm space-y-5 text-center">
          <div className="mx-auto flex size-20 items-center justify-center rounded-full border border-primary/30 bg-primary/10"><PawPrint className="size-9 text-primary" /></div>
          <h2 className="font-display text-4xl italic leading-none">Adopt your puppy</h2>
          <p className="text-sm text-muted-foreground">A little companion, a backyard of their own.</p>
          <label className="block text-sm text-muted-foreground" htmlFor="puppy-name">Name your puppy</label>
          <input id="puppy-name" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} className="mx-auto block w-full max-w-xs rounded-md border border-border bg-surface px-4 py-3 text-center text-foreground" />
          <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">Adoption fee <LuviesAmount value={data?.cost ?? 250} size="sm" /></p>
          <Button variant="petal" size="lg" disabled={busy || !wallet || wallet.balance < (data?.cost ?? 250)} onClick={async () => { setBusy(true); try { await adopt({ data: { name } }); puppySound("bark"); await Promise.all([qc.invalidateQueries({ queryKey: ["puppy"] }), qc.invalidateQueries({ queryKey: ["luvies"] })]); toast.success("Your puppy is home!"); } catch (e) { toast.error(e instanceof Error ? e.message : "Adoption failed"); } finally { setBusy(false); } }}>{wallet && wallet.balance < (data?.cost ?? 250) ? "Not enough Luvies" : busy ? "Bringing puppy home…" : "Bring them home"}</Button>
          {wallet && wallet.balance < (data?.cost ?? 250) && <p className="text-sm text-muted-foreground">You need more Luvies to adopt. <Link to="/app/wallet" className="text-primary underline">View your wallet</Link></p>}
        </section>
      ) : deceased ? (
        <section className="mx-auto max-w-lg space-y-5 py-16 text-center"><div className="text-6xl">🐾</div><h2 className="font-display text-3xl">Remembering {puppy.name}</h2><p className="text-muted-foreground">Your puppy's time in the backyard has come to an end. Thank you for all the love and play.</p><Link to="/app/pet" className="inline-block text-primary underline">Back to pets</Link></section>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)]">
          <section className="min-w-0 space-y-5">
            <PuppyYard name={puppy.name} mood={mood} playing={playing} onPat={() => void perform("pat")} />
            <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs uppercase text-muted-foreground">Your companion</p>{editing ? <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { await rename({ data: { name } }); await qc.invalidateQueries({ queryKey: ["puppy"] }); setEditing(false); } catch (err) { toast.error(err instanceof Error ? err.message : "Couldn't rename puppy"); } finally { setBusy(false); } }}><input aria-label="Puppy name" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} className="w-36 rounded-md border border-border bg-surface px-2 text-foreground" /><Button size="sm" disabled={busy}>Save</Button></form> : <Button variant="ghost" onClick={() => setEditing(true)} className="h-auto px-0 font-display text-2xl text-foreground" title="Rename puppy">{puppy.name}<Pencil className="size-3.5 text-muted-foreground" /></Button>}</div><span className="flex items-center gap-1.5 text-sm text-muted-foreground"><Flame className="size-4 text-primary" />{puppy.streak} day streak</span></div>
            <div className="grid grid-cols-2 gap-3"><Meter label="Fullness" value={fullness} icon={<Bone className="size-4" />} /><Meter label="Affection" value={puppy.affection} icon={<Heart className="size-4" />} /></div>
            <p className="text-xs text-muted-foreground">{Math.max(0, Math.ceil(STARVE_HOURS - hoursSinceFed(puppy.last_fed_at)))} hours until your puppy needs a meal · {puppy.interactions} moments together</p>
          </section>
          <section className="min-w-0 space-y-8 lg:pt-2">
            <div><h2 className="mb-4 flex items-center gap-2 font-display text-2xl"><Sparkles className="size-5 text-primary" /> Play together</h2><div className="grid grid-cols-2 gap-3">{([
              ["fetch", CircleDot, "Fetch"], ["tug", Activity, "Tug of war"], ["paw", PawPrint, "Shake paw"], ["belly", Heart, "Belly rub"], ["nap", Moon, "Nap"], ["pat", Hand, "Pet"]
            ] as const).map(([action, Icon, label]) => <Button key={action} variant="quiet" aria-pressed={playing === action} className={`h-20 flex-col gap-2 border-border bg-surface/60 text-sm backdrop-blur-xl transition-colors hover:border-primary/50 ${playing === action ? "border-primary bg-primary/10 text-primary" : ""}`} disabled={busy} onClick={() => void perform(action)}><Icon className="size-5 text-primary" />{label}</Button>)}</div></div>
            <div><div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 font-display text-xl"><Bone className="size-5 text-primary" /> Food bowl</h2><Link to="/app/mart" className="flex items-center gap-1 text-sm text-primary"><ShoppingBag className="size-4" /> Shop</Link></div>{availableFood.length ? <div className="space-y-2">{availableFood.map(([key, qty]) => { const food = PUPPY_FOOD_BY_KEY[key]; return <div key={key} className="flex items-center gap-3 border-b border-border py-2"><span className="text-2xl">{food.emoji}</span><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{food.name}</p><p className="text-xs text-muted-foreground">{qty} in bowl · +{food.fullness} fullness</p></div><Button variant="soft" size="sm" disabled={busy} onClick={() => void eat(key)}>Feed</Button></div>; })}</div> : <div className="space-y-4 border-y border-border py-6 text-center"><Bone className="mx-auto size-8 text-primary/60" /><p className="text-sm text-muted-foreground">Your puppy's bowl is empty.</p><Button asChild variant="soft"><Link to="/app/mart"><ShoppingBag className="size-4" /> Shop puppy meals</Link></Button></div>}<p className="mt-4 text-xs text-muted-foreground">{PUPPY_FOODS.length} puppy-safe meals and treats in the supermarket.</p></div>
            <div className="flex items-start gap-2 border-t border-border pt-4 text-xs text-muted-foreground"><Heart className="size-4 shrink-0 text-primary" /> Your panda is still waiting in its own home. Puppy care is separate.</div>
          </section>
        </div>
      )}
    </main>
  );
}

function Meter({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return <div className="border-t border-border pt-3"><div className="flex justify-between text-sm"><span className="flex items-center gap-2 text-muted-foreground">{icon} {label}</span><span>{Math.round(value)}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full transition-[width] ${label === "Fullness" && value < 25 ? "bg-destructive" : "bg-primary"}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div></div>;
}