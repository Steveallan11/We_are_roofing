import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { GaugeFAB } from "@/components/layout/GaugeFAB";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { PageHeader } from "@/components/layout/PageHeader";
import { Starfield } from "@/components/ui/starfield";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
};

export function AppShell({ title, subtitle, actions, children, wide = false }: Props) {
  return (
    <div className="relative min-h-screen">
      <Starfield />
      <div className="relative z-10 flex min-h-screen">
        <AdminSidebar />
        <main className="min-w-0 flex-1">
          <div className={cn("app-shell", wide && "!max-w-[1600px]")}>
            <PageHeader actions={actions} subtitle={subtitle} title={title} />
            {children}
          </div>
        </main>
      </div>
      <MobileBottomNav />
      <GaugeFAB />
    </div>
  );
}
