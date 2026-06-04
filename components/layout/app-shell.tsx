import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { GaugeFAB } from "@/components/layout/GaugeFAB";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { PageHeader } from "@/components/layout/PageHeader";
import { OfflineIndicator } from "@/components/offline/OfflineIndicator";
import { Starfield } from "@/components/ui/starfield";
import { requireAdminSession } from "@/lib/auth";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  breadcrumb?: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
  /** Disable sticky header (default on). */
  stickyHeader?: boolean;
};

export async function AppShell({
  title,
  subtitle,
  actions,
  breadcrumb,
  children,
  wide = false,
  stickyHeader = true
}: Props) {
  await requireAdminSession();

  return (
    <div className="relative min-h-screen">
      <Starfield />
      <div className="relative z-10 flex min-h-screen">
        <AdminSidebar />
        <main className="min-w-0 flex-1">
          <div className={cn("app-shell", wide && "!max-w-[1600px]")}>
            <PageHeader
              actions={actions}
              breadcrumb={breadcrumb}
              subtitle={subtitle}
              title={title}
              sticky={stickyHeader}
            />
            {children}
          </div>
        </main>
      </div>
      <MobileBottomNav />
      <GaugeFAB />
      <OfflineIndicator />
    </div>
  );
}
