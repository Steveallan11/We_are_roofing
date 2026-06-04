"use client";

import { useEffect, useState } from "react";
import type { CostLineItem, PricingRule } from "@/lib/types";

type ValidationWarning = {
  lineIndex: number;
  item: string;
  message: string;
  severity: "warning" | "error";
};

type Props = {
  costBreakdown: CostLineItem[];
  jobId: string;
  onWarningsChange?: (warnings: ValidationWarning[]) => void;
};

export function PricingValidation({ costBreakdown, jobId, onWarningsChange }: Props) {
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [warnings, setWarnings] = useState<ValidationWarning[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadRules() {
      try {
        const response = await fetch("/api/settings/pricing-rules");
        if (response.ok) {
          const data = await response.json();
          setRules(data.rules || []);
        }
      } catch (err) {
        console.error("Failed to load pricing rules:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadRules();
  }, []);

  useEffect(() => {
    const newWarnings: ValidationWarning[] = [];

    costBreakdown.forEach((line, index) => {
      if (!line.item || Number(line.cost || 0) === 0) return;

      const cost = Number(line.cost || 0);
      const category = line.item.toLowerCase();

      rules.forEach((rule) => {
        if (!rule.active) return;

        const ruleMatches =
          rule.item_category.toLowerCase() === category ||
          rule.item_category.toLowerCase().includes(category) ||
          category.includes(rule.item_category.toLowerCase());

        if (ruleMatches) {
          if (rule.minimum_price && cost < rule.minimum_price) {
            newWarnings.push({
              lineIndex: index,
              item: line.item,
              message: `Price (£${cost.toFixed(2)}) is below minimum of £${rule.minimum_price.toFixed(2)} for ${rule.item_category}`,
              severity: "warning"
            });
          }
          if (rule.maximum_price && cost > rule.maximum_price) {
            newWarnings.push({
              lineIndex: index,
              item: line.item,
              message: `Price (£${cost.toFixed(2)}) exceeds maximum of £${rule.maximum_price.toFixed(2)} for ${rule.item_category}`,
              severity: "error"
            });
          }
        }
      });
    });

    setWarnings(newWarnings);
    onWarningsChange?.(newWarnings);
  }, [costBreakdown, rules, onWarningsChange]);

  if (isLoading) return null;
  if (warnings.length === 0) return null;

  const errorCount = warnings.filter((w) => w.severity === "error").length;
  const warningCount = warnings.filter((w) => w.severity === "warning").length;

  return (
    <div className="space-y-2 rounded-lg border border-[#ef4444]/30 bg-[#ef4444]/10 p-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-[#ff9a91]">
          {errorCount > 0 ? `${errorCount} pricing violation${errorCount !== 1 ? "s" : ""}` : ""}
          {errorCount > 0 && warningCount > 0 ? ", " : ""}
          {warningCount > 0 ? `${warningCount} warning${warningCount !== 1 ? "s" : ""}` : ""}
        </span>
      </div>

      <div className="space-y-1 text-sm">
        {warnings.map((warning, idx) => (
          <div key={idx} className={warning.severity === "error" ? "text-[#ff9a91]" : "text-[#ffb366]"}>
            {warning.item}: {warning.message}
          </div>
        ))}
      </div>

      {errorCount > 0 && (
        <p className="mt-2 text-xs text-[#ff9a91]">
          Fix pricing violations before sending the quote to the customer.
        </p>
      )}
    </div>
  );
}
