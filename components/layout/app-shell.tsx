import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-background">
      {/* Fixed top header */}
      <AppHeader />

      {/* Body: sidebar + main */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <AppSidebar />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}
