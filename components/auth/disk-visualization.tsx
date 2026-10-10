"use client";

import { DEFAULT_DISK_CONFIG } from "@/lib/fs/types";
import { useEffect, useState } from "react";
import styles from "./auth-layout.module.css";

type Status = "free" | "contiguous" | "linked" | "index" | "indexed data";
type DemoBlock = { status: Status; file?: string; next?: number | null; entries?: number[] };

const demo: Record<number, DemoBlock> = {
  3: { status: "linked", file: "notes.txt", next: 17 },
  17: { status: "linked", file: "notes.txt", next: null },
  8: { status: "contiguous", file: "report.pdf" },
  9: { status: "contiguous", file: "report.pdf" },
  30: { status: "index", file: "archive.zip", entries: [14, 26] },
  14: { status: "indexed data", file: "archive.zip" },
  26: { status: "indexed data", file: "archive.zip" },
};

const palette: Record<Status, string> = {
  free: "border-zinc-800/80 bg-zinc-900/65 hover:border-zinc-600 hover:bg-zinc-800",
  contiguous: "border-violet-400/45 bg-violet-500/55 hover:bg-violet-500/75",
  linked: "border-sky-400/45 bg-sky-500/55 hover:bg-sky-500/75",
  index: "border-amber-400/45 bg-amber-400/60 hover:bg-amber-400/75",
  "indexed data": "border-amber-400/35 bg-amber-500/25 hover:bg-amber-500/40",
};

export function DiskVisualization() {
  const totalBlocks = DEFAULT_DISK_CONFIG.totalBlocks;
  const [visibleBlocks, setVisibleBlocks] = useState(Math.min(totalBlocks, 48));

  useEffect(() => {
    const updateDensity = () => {
      const shortViewport = window.matchMedia("(max-height: 800px)").matches;
      const compactWidth = window.matchMedia("(max-width: 1023px)").matches;
      setVisibleBlocks(Math.min(totalBlocks, compactWidth ? 32 : shortViewport ? 48 : 64));
    };
    updateDensity();
    window.addEventListener("resize", updateDensity);
    return () => window.removeEventListener("resize", updateDensity);
  }, [totalBlocks]);

  return (
    <div className={styles.disk}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Virtual disk / allocation map</p>
          <p className="mt-1 font-mono text-[10px] tracking-wide text-zinc-500">Illustrative sample · default model · {totalBlocks.toLocaleString()} blocks</p>
        </div>
        <span className="font-mono text-[10px] text-zinc-600">0—{Math.max(visibleBlocks - 1, 0).toString().padStart(2, "0")}</span>
      </div>

      <div className="grid grid-cols-8 gap-1.5 lg:grid-cols-16 lg:gap-1.5" role="group" aria-label={`Illustrative sample of ${visibleBlocks} virtual disk blocks`}>
        {Array.from({ length: visibleBlocks }, (_, index) => {
          const block = demo[index] ?? { status: "free" as const };
          const description = block.status === "free"
            ? `Block ${index}: free`
            : `Block ${index}: ${block.status} block${block.file ? ` for ${block.file}` : ""}${block.status === "linked" ? block.next === null ? ", end of chain" : `, points to block ${block.next}` : ""}`;
          const details = block.entries ? `${description}; references blocks ${block.entries.join(", ")}` : description;
          const animated = block.status !== "free";
          return (
            <button
              key={index}
              type="button"
              aria-label={details}
              title={details}
              className={`group relative aspect-square min-h-0 rounded-[2px] border transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#111112] ${palette[block.status]} ${animated ? "disk-block-active" : ""}`}
              style={animated ? { animationDelay: `${(index % 9) * 170}ms` } : undefined}
            >
              <span role="tooltip" className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-20 hidden w-max max-w-48 -translate-x-1/2 border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-left font-mono text-[10px] leading-4 text-zinc-200 shadow-lg group-hover:block group-focus-visible:block">
                {details}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 pt-1 font-mono text-[10px] tracking-wide text-zinc-500 sm:gap-x-5" aria-label="Allocation legend">
        {([
          ["bg-zinc-700", "Free"], ["bg-violet-400", "Contiguous"], ["bg-sky-500", "Linked"], ["bg-amber-500", "Index"], ["bg-amber-500/50", "Indexed data"],
        ] as const).map(([color, label]) => (
          <span key={label} className="inline-flex items-center gap-1.5"><i className={`size-2 rounded-[2px] ${color}`} />{label}</span>
        ))}
      </div>
      <style jsx>{`
        .disk-block-active { animation: block-breathe 6s ease-in-out infinite; }
        @keyframes block-breathe { 0%, 100% { filter: brightness(1); } 50% { filter: brightness(1.1); } }
        @media (prefers-reduced-motion: reduce) { .disk-block-active { animation: none; } }
      `}</style>
    </div>
  );
}
