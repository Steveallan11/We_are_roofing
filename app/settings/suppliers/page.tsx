import { AppShell } from "@/components/layout/app-shell";
import { SuppliersWorkspace } from "@/components/settings/suppliers-workspace";
import { getSuppliers } from "@/lib/data";

export default async function SuppliersPage() {
  const suppliers = await getSuppliers();

  return (
    <AppShell title="Suppliers" subtitle="Manage trade suppliers, account references, contacts, and preferred sources for materials.">
      <SuppliersWorkspace initialSuppliers={suppliers} />
    </AppShell>
  );
}
