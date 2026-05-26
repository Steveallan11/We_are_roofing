-- Repair WR-Q-1009 quote option JSON so both options use explicit metadata
-- and separate roof/access line items. This only touches the We Are Roofing
-- quotes table and does not touch any Luminary tables.

UPDATE public.quotes
SET
  options = '[
    {
      "id": "option-a",
      "label": "Option A",
      "option_type": "standard_scaffold",
      "title": "Standard Scaffold",
      "short_description": "Best lower upfront cost",
      "description": "A full roof refurbishment with standard scaffold access. This is the lower-cost option, but it does not include a temporary roof covering during the works.",
      "recommended": false,
      "cost_breakdown": [
        {
          "item": "Roof works",
          "cost": 182555,
          "vat_applicable": true,
          "notes": "",
          "pricing_category": "roof_works",
          "quote_section": "roof_works",
          "source_id": "roof-works"
        },
        {
          "item": "Standard scaffold",
          "cost": 16500,
          "vat_applicable": true,
          "notes": "",
          "pricing_category": "standard_scaffold",
          "quote_section": "access",
          "source_id": "standard-scaffold"
        }
      ],
      "subtotal": 199055,
      "vat_amount": 39811,
      "total": 238866
    },
    {
      "id": "option-b",
      "label": "Option B",
      "option_type": "temporary_roof_protection",
      "title": "Temporary Roof Protection",
      "short_description": "Best protection during the works",
      "description": "A full roof refurbishment with a temporary roof covering in place during the works. This gives the best weather protection and helps reduce delays.",
      "recommended": true,
      "cost_breakdown": [
        {
          "item": "Roof works",
          "cost": 182555,
          "vat_applicable": true,
          "notes": "",
          "pricing_category": "roof_works",
          "quote_section": "roof_works",
          "source_id": "roof-works"
        },
        {
          "item": "Temporary roof protection",
          "cost": 64995,
          "vat_applicable": true,
          "notes": "",
          "pricing_category": "temporary_roof_protection",
          "quote_section": "access",
          "source_id": "temporary-roof-protection"
        }
      ],
      "subtotal": 247550,
      "vat_amount": 49510,
      "total": 297060
    }
  ]'::jsonb,
  subtotal = 199055,
  vat_amount = 39811,
  total = 238866,
  updated_at = now()
WHERE quote_ref = 'WR-Q-1009';
