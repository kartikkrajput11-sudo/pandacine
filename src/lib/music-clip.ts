import type { SongPick } from "./music.functions";

export const PREVIEW_SECONDS = 30;
export const DEFAULT_CLIP_SECONDS = 15;

export function clipOf(song: SongPick) {
  const length = Math.min(PREVIEW_SECONDS, Math.max(5, song.length ?? PREVIEW_SECONDS));
  const start = Math.min(Math.max(0, song.start ?? 0), PREVIEW_SECONDS - length);
  return { start, length, end: start + length };
}

/** Keeps an audio element looping inside the chosen clip. Returns a cleanup fn. */
export function loopClip(audio: HTMLAudioElement, song: SongPick, onProgress?: (p: number) => void) {
  const { start, length, end } = clipOf(song);
  const onTime = () => {
    if (audio.currentTime >= end || audio.currentTime < start - 0.5) audio.currentTime = start;
    onProgress?.(Math.min(1, Math.max(0, (audio.currentTime - start) / length)));
  };
  audio.addEventListener("timeupdate", onTime);
  return () => audio.removeEventListener("timeupdate", onTime);
}
