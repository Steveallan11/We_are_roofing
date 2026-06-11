"use client";

import { useEffect, useState } from "react";
import { Button, Card } from "@/components/ui/primitives";
import type { NurtureTemplate } from "@/lib/types";

export function NurtureTemplatesEditor() {
  const [templates, setTemplates] = useState<NurtureTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/settings/nurture-templates");
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load templates");
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (template: NurtureTemplate) => {
    setEditingId(template.id);
    setEditData({
      subject: template.subject,
      body: template.body,
      is_active: template.is_active
    });
    setError(null);
    setSuccess(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData({});
  };

  const saveTemplate = async (templateId: string) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/nurture-templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          subject: editData.subject,
          body: editData.body,
          is_active: editData.is_active
        })
      });

      if (res.ok) {
        const data = await res.json();
        setTemplates(templates.map((t) => (t.id === templateId ? data.template : t)));
        setSuccess("Template saved successfully");
        setEditingId(null);
        setEditData({});
      } else {
        const data = await res.json();
        setError(data.error || "Failed to save template");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  const seedDefaults = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/nurture-templates/seed", {
        method: "POST"
      });

      if (res.ok) {
        const data = await res.json();
        setSuccess(`Created ${data.count} default templates`);
        await loadTemplates();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to create defaults");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-[var(--muted)]">Loading templates...</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-[var(--text)]">Nurture Email Templates</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Customize the follow-up emails sent to customers after they receive a quote.
          Use {"{customer_name}"} and {"{job_title}"} as placeholders.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-3 text-sm text-green-400">
          {success}
        </div>
      )}

      {templates.length === 0 && (
        <Card padding="md" variant="outlined">
          <div className="space-y-3 text-center py-6">
            <p className="text-sm text-[var(--muted)]">
              No nurture templates found. Click below to create the default 3-email sequence (Days 3, 7, 14).
            </p>
            <Button variant="primary" size="md" onClick={seedDefaults} disabled={saving}>
              {saving ? "Creating..." : "Create Default Templates"}
            </Button>
          </div>
        </Card>
      )}

      <div className="space-y-4">
        {templates.map((template) => (
          <Card key={template.id} padding="md" variant="outlined">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
                    Day {template.day_number}
                  </span>
                  {!template.is_active && (
                    <span className="text-xs font-semibold uppercase tracking-widest text-red-500">
                      Disabled
                    </span>
                  )}
                </div>

                {editingId === template.id ? (
                  <div className="mt-3 space-y-3">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
                        Subject
                      </label>
                      <input
                        type="text"
                        value={editData.subject as string}
                        onChange={(e) => setEditData({ ...editData, subject: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/20 px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--muted)]"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
                        Body
                      </label>
                      <textarea
                        value={editData.body as string}
                        onChange={(e) => setEditData({ ...editData, body: e.target.value })}
                        rows={8}
                        className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/20 px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--muted)] font-mono"
                      />
                    </div>

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={editData.is_active as boolean}
                        onChange={(e) => setEditData({ ...editData, is_active: e.target.checked })}
                        className="rounded"
                      />
                      <span className="text-sm text-[var(--text)]">Active</span>
                    </label>

                    <div className="flex gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => saveTemplate(template.id)}
                        disabled={saving}
                      >
                        Save
                      </Button>
                      <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={saving}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="mt-2 text-sm font-medium text-[var(--text)]">{template.subject}</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--text-second)]">
                      {template.body}
                    </p>
                  </>
                )}
              </div>

              {editingId !== template.id && (
                <Button variant="ghost" size="sm" onClick={() => startEdit(template)}>
                  Edit
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
