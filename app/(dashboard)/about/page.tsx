import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Blocks, FolderTree, Workflow } from "lucide-react";

export default function AboutPage() {
  return (
    <>
      <PageHeader
        title="About MiniFS"
        description="Operating Systems mini project — browser-based file system simulator for college demonstration."
      />
      <div className="flex-1 space-y-5 px-5 py-6 sm:px-7 lg:px-9">
        <Card className="border border-border bg-card shadow-none">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Objective</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              MiniFS demonstrates core OS ideas: directories, file metadata,
              virtual disk blocks, free-space tracking, and contiguous, linked,
              and indexed allocation — with a polished UI suitable for mentor
              review.
            </p>
          </CardContent>
        </Card>

        <div className="grid gap-3 md:grid-cols-3">
          {[
            { icon: FolderTree, title: "Directory hierarchy", copy: "Stable IDs, parent relationships, and safe file operations including move, copy and rename." },
            { icon: Blocks, title: "Virtual disk", copy: "A 1,024-block × 1 KiB configurable block map with free-space accounting and visual inspection." },
            { icon: Workflow, title: "Allocation strategies", copy: "Contiguous, linked, and indexed layouts to inspect and compare side by side." },
          ].map(({ icon: Icon, title, copy }) => (
            <div key={title} className="rounded-xl border border-border bg-card p-4">
              <Icon className="size-4 text-primary" />
              <h2 className="mt-4 text-sm font-medium">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy}</p>
            </div>
          ))}
        </div>

        <Card className="border border-border bg-card shadow-none">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Stack</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <div className="flex flex-wrap gap-2">
              {[
                "Next.js 16",
                "TypeScript",
                "Tailwind CSS v4",
                "shadcn/ui",
                "Lucide React",
                "Supabase Auth",
                "Supabase PostgreSQL",
                "Supabase Storage",
                "CodeMirror 6",
              ].map((tech) => (
                <span
                  key={tech}
                  className="rounded-md border border-border bg-muted/30 px-2.5 py-1 text-xs text-foreground"
                >
                  {tech}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card shadow-none">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Project team</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <ul className="space-y-2.5">
              {[
                { name: "Aarush Naskar", roll: "RA2511028020006" },
                { name: "Pritam Saha", roll: "RA2511028020007" },
                { name: "Harsh Prakash", roll: "RA2511028020040" },
              ].map(({ name, roll }) => (
                <li key={roll} className="flex items-center justify-between gap-4">
                  <span className="font-medium text-foreground">{name}</span>
                  <span className="font-mono text-xs tracking-wide">{roll}</span>
                </li>
              ))}
            </ul>
            <Separator className="my-4" />
            <p className="text-xs">
              Operating Systems mini project — SRM Institute of Science and Technology.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
