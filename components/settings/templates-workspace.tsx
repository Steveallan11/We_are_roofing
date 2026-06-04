"use client";

import { useState, useTransition } from "react";
import type { Business, KnowledgeExample, PricingRule, QuoteTemplate } from "@/lib/types";
import { ROOF_TYPES } from "@/lib/constants";

type Props = {
  business: Business;
  initialTemplates: QuoteTemplate[];
  initialRules: PricingRule[];
  initialExamples: KnowledgeExample[];
};

export function TemplatesWorkspace({ business, initialTemplates, initialRules, initialExamples }: Props) {
  const [activeTab, setActiveTab] = useState<"defaults" | "templates" | "pricing" | "knowledge">("defaults");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Defaults (Global)
  const [guaranteeText, setGuaranteeText] = useState(business.guarantee_text || "");
  const [exclusions, setExclusions] = useState(business.default_exclusions || "");
  const [terms, setTerms] = useState(business.default_terms || "");

  // Templates
  const [templates, setTemplates] = useState<QuoteTemplate[]>(initialTemplates);
  const [newTemplate, setNewTemplate] = useState({ roof_type: "Pitched Tile", template_name: "", roof_report_template: "" });

  // Pricing Rules
  const [rules, setRules] = useState<PricingRule[]>(initialRules);
  const [newRule, setNewRule] = useState({ item_category: "", minimum_price: "", maximum_price: "" });

  // Knowledge Examples
  const [examples, setExamples] = useState<KnowledgeExample[]>(initialExamples);
  const [newExample, setNewExample] = useState({ example_type: "roof_report" as const, title: "", content: "" });

  async function saveDefaults() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await fetch("/api/settings/business", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guarantee_text: guaranteeText,
          default_exclusions: exclusions,
          default_terms: terms
        })
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; message?: string };
      if (!res.ok || !data?.ok) {
        setError(data?.error || "Unable to save defaults");
      } else {
        setMessage("Quote defaults saved");
      }
    });
  }

  async function addTemplate() {
    if (!newTemplate.template_name) {
      setError("Template name is required");
      return;
    }
    const res = await fetch("/api/settings/quote-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newTemplate, business_id: business.id })
    });
    const data = (await res.json().catch(() => null)) as { ok?: boolean; template?: QuoteTemplate; error?: string };
    if (!res.ok || !data?.ok || !data.template) {
      setError(data?.error || "Unable to create template");
    } else {
      setTemplates([...templates, data.template]);
      setNewTemplate({ roof_type: "Pitched Tile", template_name: "", roof_report_template: "" });
      setMessage("Template created");
    }
  }

  async function addRule() {
    if (!newRule.item_category) {
      setError("Item category is required");
      return;
    }
    const res = await fetch("/api/settings/pricing-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...newRule,
        minimum_price: newRule.minimum_price ? parseFloat(newRule.minimum_price) : null,
        maximum_price: newRule.maximum_price ? parseFloat(newRule.maximum_price) : null,
        business_id: business.id
      })
    });
    const data = (await res.json().catch(() => null)) as { ok?: boolean; rule?: PricingRule; error?: string };
    if (!res.ok || !data?.ok || !data.rule) {
      setError(data?.error || "Unable to create rule");
    } else {
      setRules([...rules, data.rule]);
      setNewRule({ item_category: "", minimum_price: "", maximum_price: "" });
      setMessage("Pricing rule created");
    }
  }

  async function addExample() {
    if (!newExample.title || !newExample.content) {
      setError("Title and content are required");
      return;
    }
    const res = await fetch("/api/settings/knowledge-examples", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newExample, business_id: business.id })
    });
    const data = (await res.json().catch(() => null)) as { ok?: boolean; example?: KnowledgeExample; error?: string };
    if (!res.ok || !data?.ok || !data.example) {
      setError(data?.error || "Unable to create example");
    } else {
      setExamples([data.example, ...examples]);
      setNewExample({ example_type: "roof_report", title: "", content: "" });
      setMessage("Knowledge example added");
    }
  }

  return (
    <div className="stack">
      {(message || error) && (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${error ? "border-[#ef4444]/30 bg-[#ef4444]/10 text-[#ff9a91]" : "border-[#10b981]/30 bg-[#10b981]/10 text-[#7ce3a6]"}`}>
          {error || message}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="card p-0">
        <div className="flex border-b border-[var(--border)]">
          {(["defaults", "templates", "pricing", "knowledge"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 border-b-2 px-5 py-3 text-sm font-semibold transition ${
                activeTab === tab
                  ? "border-[var(--gold)] text-[var(--gold)]"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              {tab === "defaults"
                ? "Global Defaults"
                : tab === "templates"
                  ? "Templates"
                  : tab === "pricing"
                    ? "Pricing Rules"
                    : "Knowledge Examples"}
            </button>
          ))}
        </div>

        <div className="p-5">
          {activeTab === "defaults" && (
            <DefaultsTab
              guaranteeText={guaranteeText}
              setGuaranteeText={setGuaranteeText}
              exclusions={exclusions}
              setExclusions={setExclusions}
              terms={terms}
              setTerms={setTerms}
              onSave={saveDefaults}
              isPending={isPending}
            />
          )}

          {activeTab === "templates" && (
            <TemplatesTab
              templates={templates}
              newTemplate={newTemplate}
              setNewTemplate={setNewTemplate}
              onAdd={addTemplate}
              isPending={isPending}
            />
          )}

          {activeTab === "pricing" && (
            <PricingTab
              rules={rules}
              newRule={newRule}
              setNewRule={setNewRule}
              onAdd={addRule}
              isPending={isPending}
            />
          )}

          {activeTab === "knowledge" && (
            <KnowledgeTab
              examples={examples}
              newExample={newExample}
              setNewExample={setNewExample}
              onAdd={addExample}
              isPending={isPending}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function DefaultsTab({
  guaranteeText,
  setGuaranteeText,
  exclusions,
  setExclusions,
  terms,
  setTerms,
  onSave,
  isPending
}: any) {
  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-semibold text-[var(--text)]">Guarantee Text</label>
        <p className="mt-1 text-xs text-[var(--text-muted)]">Used in all quotes unless overridden by a template</p>
        <textarea
          value={guaranteeText}
          onChange={(e) => setGuaranteeText(e.target.value)}
          className="field mt-3 min-h-24"
          placeholder="All work is carried out to industry standard..."
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-[var(--text)]">Exclusions</label>
        <p className="mt-1 text-xs text-[var(--text-muted)]">What is NOT included in quotes</p>
        <textarea
          value={exclusions}
          onChange={(e) => setExclusions(e.target.value)}
          className="field mt-3 min-h-24"
          placeholder="This quotation does not include..."
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-[var(--text)]">Terms</label>
        <p className="mt-1 text-xs text-[var(--text-muted)]">Payment terms, validity period, deposit requirements</p>
        <textarea
          value={terms}
          onChange={(e) => setTerms(e.target.value)}
          className="field mt-3 min-h-24"
          placeholder="This quotation is valid for 30 days..."
        />
      </div>

      <button onClick={onSave} disabled={isPending} className="button-primary">
        Save Defaults
      </button>
    </div>
  );
}

function TemplatesTab({ templates, newTemplate, setNewTemplate, onAdd, isPending }: any) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-[var(--text)]">Create New Template</h3>
        <div className="mt-4 grid gap-4">
          <select
            value={newTemplate.roof_type}
            onChange={(e) => setNewTemplate({ ...newTemplate, roof_type: e.target.value })}
            className="field"
          >
            {ROOF_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={newTemplate.template_name}
            onChange={(e) => setNewTemplate({ ...newTemplate, template_name: e.target.value })}
            placeholder="Template name (e.g. 'Standard Repair')"
            className="field"
          />
          <textarea value={newTemplate.roof_report_template} onChange={(e) => setNewTemplate({ ...newTemplate, roof_report_template: e.target.value })} placeholder="Roof report template" className="field min-h-24" />
          <button onClick={onAdd} disabled={isPending} className="button-primary">
            Create Template
          </button>
        </div>
      </div>

      {templates.length > 0 && (
        <div>
          <h3 className="font-semibold text-[var(--text)]">Existing Templates</h3>
          <div className="mt-4 space-y-2">
            {templates.map((t) => (
              <div key={t.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface-deep)] p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-[var(--text)]">{t.template_name}</p>
                    <p className="text-xs text-[var(--text-muted)]">{t.roof_type}</p>
                  </div>
                  <button className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]">Edit</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PricingTab({ rules, newRule, setNewRule, onAdd, isPending }: any) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-[var(--text)]">Add Pricing Rule</h3>
        <p className="mt-1 text-xs text-[var(--text-muted)]">Set minimum/maximum bounds to catch pricing mistakes before sending quotes</p>
        <div className="mt-4 grid gap-4">
          <input
            type="text"
            value={newRule.item_category}
            onChange={(e) => setNewRule({ ...newRule, item_category: e.target.value })}
            placeholder="Item category (e.g. 'Roof Works', 'Scaffolding')"
            className="field"
          />
          <div className="grid grid-cols-2 gap-4">
            <input
              type="number"
              value={newRule.minimum_price}
              onChange={(e) => setNewRule({ ...newRule, minimum_price: e.target.value })}
              placeholder="Min price £"
              className="field"
            />
            <input
              type="number"
              value={newRule.maximum_price}
              onChange={(e) => setNewRule({ ...newRule, maximum_price: e.target.value })}
              placeholder="Max price £"
              className="field"
            />
          </div>
          <button onClick={onAdd} disabled={isPending} className="button-primary">
            Add Rule
          </button>
        </div>
      </div>

      {rules.length > 0 && (
        <div>
          <h3 className="font-semibold text-[var(--text)]">Active Rules</h3>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-[var(--border)]">
                <tr>
                  <th className="text-left py-2">Category</th>
                  <th className="text-left py-2">Min</th>
                  <th className="text-left py-2">Max</th>
                  <th className="text-left py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id} className="border-b border-[var(--border)]/30">
                    <td className="py-2">{r.item_category}</td>
                    <td className="py-2">{r.minimum_price ? `£${r.minimum_price}` : "—"}</td>
                    <td className="py-2">{r.maximum_price ? `£${r.maximum_price}` : "—"}</td>
                    <td className="py-2 text-[var(--text-muted)] hover:text-[var(--text)]">Delete</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function KnowledgeTab({ examples, newExample, setNewExample, onAdd, isPending }: any) {
  const exampleTypes = ["roof_report", "scope_of_works", "guarantee", "exclusions", "terms", "email_subject", "email_body"] as const;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-[var(--text)]">Add Knowledge Example</h3>
        <p className="mt-1 text-xs text-[var(--text-muted)]">Upload Andrew's actual quote samples to train the AI to write in his style</p>
        <div className="mt-4 grid gap-4">
          <select
            value={newExample.example_type}
            onChange={(e) => setNewExample({ ...newExample, example_type: e.target.value })}
            className="field"
          >
            {exampleTypes.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={newExample.title}
            onChange={(e) => setNewExample({ ...newExample, title: e.target.value })}
            placeholder="Title (e.g. 'Pitched tile repair - 2024')"
            className="field"
          />
          <textarea
            value={newExample.content}
            onChange={(e) => setNewExample({ ...newExample, content: e.target.value })}
            placeholder="Paste the actual content from a quote Andrew approved..."
            className="field min-h-32"
          />
          <button onClick={onAdd} disabled={isPending} className="button-primary">
            Add Example
          </button>
        </div>
      </div>

      {examples.length > 0 && (
        <div>
          <h3 className="font-semibold text-[var(--text)]">Knowledge Base</h3>
          <div className="mt-4 space-y-3 max-h-96 overflow-y-auto">
            {examples.map((ex) => (
              <div key={ex.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface-deep)] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[var(--gold)] uppercase">{ex.example_type}</p>
                    <p className="font-semibold text-[var(--text)]">{ex.title}</p>
                    <p className="mt-1 text-sm text-[var(--text-muted)] line-clamp-2">{ex.content}</p>
                  </div>
                  <button className="shrink-0 text-xs text-[var(--text-muted)] hover:text-[var(--text)]">×</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
