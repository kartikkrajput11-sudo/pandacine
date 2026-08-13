/**
 * Chat moments — shared data for the premium chat features:
 * Love Letter, Confession Jar, Time Capsule.
 */

export const CONFESSION_PROMPTS = [
  "Something I never told you…",
  "The moment I knew.",
  "A small thing you do that I adore.",
  "What I was too shy to say last week.",
  "A memory of us I replay often.",
  "Something I want us to try together.",
  "A fear I've been carrying.",
  "What I'm most grateful for about you.",
  "The first thing I noticed about you.",
  "A promise I want to make you.",
  "Something that made me smile today because of you.",
  "What I hope our next year looks like.",
];

export function drawConfessionPrompt(exclude?: string) {
  const pool = CONFESSION_PROMPTS.filter((p) => p !== exclude);
  return pool[Math.floor(Math.random() * pool.length)];
}

export function formatUnlockCountdown(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return null;
  const mins = Math.floor(ms / 60000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins % 60}m`;
  return `${Math.max(1, mins)}m`;
}
