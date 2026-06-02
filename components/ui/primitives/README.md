# UI Primitives

The shared component layer for We Are Roofing. Import everything from `@/components/ui/primitives` — never reach into individual files.

```tsx
import { Button, Card, Stat, Sheet, SheetContent, Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/primitives";
```

These primitives wrap Radix UI for accessibility (focus traps, keyboard nav, ARIA) and apply our design tokens via CSS variables. They replace the ad-hoc `.button-primary` / `.card` / `.field` CSS classes — those should be migrated as pages are touched.

## Design rules

When using primitives, apply these rules (from the design plan):

1. **One gold per screen** — only one `<Button variant="primary">` visible at a time. Everything else `secondary`, `ghost`, or `subtle`.
2. **No cards-inside-cards** — group inside a `<Card>` with section dividers (`border-t border-[var(--border)] pt-4`), not nested `<Card>`s.
3. **Touch targets ≥ 44px** — `<Button size="md">` and `<Input>` already enforce this. Don't shrink with `!h-8`.
4. **Action consolidation** — show max 2 primary actions, put the rest in `<DropdownMenu>`.
5. **Spacing scale** — only use `gap-1/2/3/4/6/8/12` (4 / 8 / 12 / 16 / 24 / 32 / 48 px). Avoid arbitrary values.

---

## Components

### Button

```tsx
<Button variant="primary">Save</Button>
<Button variant="secondary" leftIcon={<Plus />}>New</Button>
<Button variant="ghost" size="sm">Cancel</Button>
<Button variant="destructive" loading>Deleting…</Button>
<Button asChild><Link href="/jobs">Open</Link></Button>
```

Variants: `primary` (gold), `secondary` (outlined gold), `ghost` (text only), `destructive` (red), `subtle` (low-contrast).
Sizes: `sm` (36px), `md` (44px – default), `lg` (52px).

### Card

```tsx
<Card>
  <CardHeader>
    <div>
      <CardKicker>Survey</CardKicker>
      <CardTitle>Pitched tile inspection</CardTitle>
    </div>
    <Badge variant="active">In Progress</Badge>
  </CardHeader>
  <CardBody>Body text...</CardBody>
  <CardFooter>
    <Button>Open</Button>
  </CardFooter>
</Card>
```

Variants: `default`, `raised`, `outlined`, `flat`. Paddings: `none/sm/md/lg`. `interactive` for hover states on clickable cards.

### Stat

```tsx
<Stat label="Jobs in pipeline" value="14" hint="Across all stages" tone="default" />
<Stat label="Overdue" value="3" tone="alert" trend={{ value: "+2", direction: "up" }} href="/jobs?filter=overdue" />
```

Replaces existing `DossierStat` / `CalendarStat` / `MetricCard`. `tone` maps to Phase 4 stage colors.

### PageSection

```tsx
<PageSection
  kicker="WR-J-0042"
  title="Recent activity"
  description="Job milestones, emails, and filed documents in date order."
  actions={<Button variant="ghost">Filter</Button>}
>
  {/* content */}
</PageSection>
```

Use `bare` to skip the card wrapper (transparent grouping).

### Badge

```tsx
<Badge variant="ready" dot>Quote ready</Badge>
<Badge variant="alert" size="sm">Overdue</Badge>
```

Use existing `<StatusBadge>` for typed job/quote/invoice statuses. Use this for generic labels.

### Sheet (bottom drawer / side panel)

```tsx
<Sheet open={open} onOpenChange={setOpen}>
  <SheetContent side="bottom" title="Day schedule">
    {/* content */}
  </SheetContent>
</Sheet>
```

`side`: `bottom` (default, mobile-friendly), `right`, `left`. Replaces inline modal CSS in `DayDetailSheet`, `DocumentShareButton`, etc.

### Dialog (modal)

```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent title="Send invoice" description="Email a PDF to the customer." size="md">
    <form>...</form>
    <DialogFooter>
      <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
      <Button variant="primary">Send</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

Centered, focus-trapped. Use `<Sheet>` instead for mobile-heavy flows.

### Input / Textarea / Select

```tsx
<Input label="Full name" required placeholder="Jane Smith" />
<Textarea label="Notes" rows={5} hint="Visible to the team only." />
<Select label="Roof type">
  <option value="pitched">Pitched tile</option>
  <option value="flat">Flat</option>
</Select>
```

16px font on mobile (prevents iOS zoom). Inline validation via `error` prop. Use `FieldShell` to wrap custom controls.

### Tabs

```tsx
<Tabs defaultValue="overview">
  <TabsList>
    <TabsTrigger value="overview">Overview</TabsTrigger>
    <TabsTrigger value="survey">Survey</TabsTrigger>
    <TabsTrigger value="quote">Quote</TabsTrigger>
  </TabsList>
  <TabsContent value="overview">…</TabsContent>
  <TabsContent value="survey">…</TabsContent>
  <TabsContent value="quote">…</TabsContent>
</Tabs>
```

Horizontally scrollable on mobile. Use for splitting dense pages like job detail.

### Accordion

```tsx
<Accordion type="single" collapsible>
  <AccordionItem value="contact">
    <AccordionTrigger>Contact details</AccordionTrigger>
    <AccordionContent>…</AccordionContent>
  </AccordionItem>
</Accordion>
```

For progressively disclosed groups. Use `type="multiple"` to allow several open at once.

### DropdownMenu

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="sm">⋯</Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuLabel>Actions</DropdownMenuLabel>
    <DropdownMenuItem icon={<Edit />}>Edit</DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem destructive>Delete</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

Use this for "overflow" actions when consolidating button rows.

### Toast

```tsx
// In root layout:
<ToastProvider>{children}</ToastProvider>

// In any component:
const { toast } = useToast();
toast({ title: "Saved", variant: "success" });
toast({ title: "Upload failed", description: "Try a smaller file", variant: "error" });
```

Replaces `alert()` calls. Auto-dismisses after 5s; swipe to dismiss on mobile.

### DataList

```tsx
<DataList
  columns={[
    { key: "ref", header: "Ref", cell: (row) => row.job_ref, mobilePrimary: true },
    { key: "customer", header: "Customer", cell: (row) => row.customer.full_name },
    { key: "status", header: "Status", cell: (row) => <StatusBadge status={row.status} />, align: "right" }
  ]}
  rows={jobs}
  rowKey={(row) => row.id}
  onRowClick={(row) => router.push(`/jobs/${row.id}`)}
  empty="No jobs match the filter."
/>
```

Renders a `<table>` on `lg:` and stacked cards on mobile. `mobilePrimary` picks the headline column on the mobile card.

---

## Adding a primitive

1. Create the file in `components/ui/primitives/Foo.tsx`. Use Radix UI for behaviour where possible.
2. Apply tokens via `var(--…)` CSS variables, not arbitrary colors.
3. Add to `index.ts`.
4. Add a usage section here.
