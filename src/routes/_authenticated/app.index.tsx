import { createFileRoute } from "@tanstack/react-router";
import { CoupleHomeDashboard } from "@/components/home/CoupleHomeDashboard";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({
    meta: [
      { title: "Our Couple Home — PANDACINE" },
      { name: "description", content: "Your shared home for daily moments, moods, memories, dates, games, and your panda." },
      { property: "og:title", content: "Our Couple Home — PANDACINE" },
      { property: "og:description", content: "Your shared home for daily moments, moods, memories, dates, games, and your panda." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CoupleHomeDashboard,
});
