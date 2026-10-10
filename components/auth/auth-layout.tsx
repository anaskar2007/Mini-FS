import { HardDrive, ShieldCheck } from "lucide-react";
import Link from "next/link";
import localFont from "next/font/local";
import { DiskVisualization } from "./disk-visualization";
import styles from "./auth-layout.module.css";

const manrope = localFont({
  src: "../../public/fonts/manrope-latin-variable.woff2",
  variable: "--font-manrope",
  weight: "200 800",
  display: "swap",
});

const methods = [
  {
    name: "Contiguous",
    color: "bg-primary",
    description: "One uninterrupted run of blocks.",
  },
  {
    name: "Linked",
    color: "bg-sky-400",
    description: "Blocks connected by pointers.",
  },
  {
    name: "Indexed",
    color: "bg-amber-400",
    description: "An index block maps the data.",
  },
];

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className={`${styles.shell} bg-background`}>
      <section className={`${styles.promo} ${manrope.variable} border-b border-border bg-[#111112] lg:border-b-0 lg:border-r`}>
        <Link href="/login" aria-label="MiniFS home" className={`${styles.brand} inline-flex w-fit items-center gap-3 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}>
          <span className="grid size-10 place-items-center border border-primary/40 bg-primary/10 text-primary">
            <HardDrive aria-hidden="true" className="size-5" />
          </span>
          <span className="flex flex-col text-left">
            <span className="text-xl font-semibold tracking-tight text-zinc-100">MiniFS</span>
            <span className="text-[10px] tracking-wide text-zinc-500">File System Simulator</span>
          </span>
        </Link>

        <div className={`${styles.promoContent} mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center`}>
          <p className={`${styles.eyebrow} flex items-center gap-2 font-mono uppercase text-zinc-500`}>
            <span className="size-1.5 rounded-full bg-primary" /> Operating Systems Project
          </p>
          <h2 className={styles.headline}>
            Every file has <span className="text-primary">a place.</span>
          </h2>
          <p className={styles.promoDescription}>
            Explore how operating systems organize data. MiniFS makes contiguous, linked, and indexed file allocation visible, one block at a time.
          </p>

          <DiskVisualization />

          <div className={`${styles.methods} grid grid-cols-1 border-t border-zinc-800/80 sm:grid-cols-3`}>
            {methods.map((method) => (
              <div key={method.name} className="min-w-0">
                <div className={styles.methodName}>
                  <span className={`size-2 rounded-[2px] ${method.color}`} aria-hidden="true" />
                  {method.name}
                </div>
                <p className={styles.methodDescription}>{method.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={`${styles.authPanel} flex flex-col justify-center`}>
        <div className={`${styles.formFrame} mx-auto w-full max-w-[430px]`}>
          {children}
          <div className={`${styles.security} flex items-center justify-center gap-2`}>
            <ShieldCheck aria-hidden="true" className="size-4 text-primary" />
            <span>Your filesystem stays private to your account.</span>
          </div>
        </div>
      </section>
    </main>
  );
}
