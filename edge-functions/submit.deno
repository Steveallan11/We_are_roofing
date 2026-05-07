import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const NOTION_API_KEY = Deno.env.get("NOTION_API_KEY");
const CUSTOMERS_DB_ID = "d65bd480-6feb-427d-ac3d-a44f096a666a";
const JOBS_DB_ID = "aa3a8478-a70a-40d7-8c76-22f976e0df3a";

// ============================================================================
// FIELD MAPPING: App field names → Notion property names
// ============================================================================

const fieldNameMap: { [key: string]: string } = {
  // Common fields
  jobTitle: "Job Title",
  propertyAddress: "Property Address",
  customerId: "Customer",
  issuesFound: "Issues Found",
  accessNotes: "Access Notes",
  asbestosRisk: "Asbestos Risk?",
  scaffoldRequired: "Scaffold Required?",
  quoteRequired: "Quote Required?",
  surveyType: "Survey Type",
  roofArea: "Approx Roof Area (m²)",
  roofCondition: "Roof Condition",
  surveyDate: "Survey Date",
  roofAge: "Roof Age (Approx)",

  // Flat Roof
  frSurfaceType: "FR — Surface Type",
  frDeckCondition: "FR — Deck Condition",
  frDrainage: "FR — Outlets / Drainage",
  frUpstands: "FR — Upstands Condition",
  frFlashings: "FR — Flashings Condition",
  frParapet: "FR — Parapet Walls Condition",
  frRooflight: "FR — Rooflight / Hatch Present?",
  frBlistering: "FR — Blistering / Cracking / Slumping?",
  frSystem: "FR — Recommended System",
  frOverlay: "FR — Previous Overlay?",
  frStandingWater: "FR — Standing Water?",
  frLeadWork: "FR — Lead Flashings Condition",

  // Pitched/Tiled
  ptTileType: "PT — Tile Type",
  ptRidgeCond: "PT — Ridge & Hip Condition",
  ptRidgeType: "PT — Ridge Type",
  ptValType: "PT — Valley Type",
  ptValCond: "PT — Valleys Condition",
  ptFelt: "PT — Felt Condition",
  ptFeltLoft: "PT — Felt Visible from Loft?",
  ptMissing: "PT — No. Missing / Broken Tiles",
  ptMoss: "PT — Moss / Algae Growth?",
  ptSolar: "PT — Solar Panels Present?",
  ptChimney: "PT — Chimney Present?",

  // Fascias
  fsMaterial: "FS — Current Material",
  fsFasciaCond: "FS — Fascia Condition",
  fsSoffitCond: "FS — Soffit Condition",
  fsGutterCond: "FS — Guttering Condition",
  fsDpCond: "FS — Downpipes Condition",
  fsGutType: "FS — Guttering Type",
  fsColour: "FS — Colour Preference",
  fsSoffitVents: "FS — Soffit Vents Present?",
  fsAsbestos: "FS — Asbestos Risk (Pre-2000)?",
  fsReplaceRepair: "FS — Full Replacement or Repair?",

  // Chimney
  chCondition: "CH — Chimney Condition",
  chLead: "CH — Lead Flashings Condition",
  chFlaunch: "CH — Flaunching Condition",
  chPointing: "CH — Render / Pointing Required?",
  chPot: "CH — Pot / Terminal Condition",
  chGasFlue: "CH — Gas Flue Present?",
  chParapet: "CH — Parapet / Coping Stones?",
};

// ============================================================================
// SELECT OPTION MAPPING: User input → Notion option names
// ============================================================================

const selectOptionMap: { [property: string]: { [userValue: string]: string } } = {
  "Survey Type": {
    "Flat Roof": "🟥 Flat Roof",
    "Pitched/Tiled": "🏠 Pitched / Tiled",
    "Fascias": "🪵 Fascias Soffits & Gutters",
    "Chimney": "🧱 Chimney & Lead Work",
    "Other": "🔧 Other / Misc",
  },

  // Flat Roof options
  "FR — Surface Type": {
    "Felt": "Felt",
    "Asphalt": "Asphalt",
    "EPDM": "EPDM Rubber",
    "GRP": "GRP Fibreglass",
    "Single Ply": "Single Ply",
    "Unknown": "Unknown",
  },
  "FR — Deck Condition": {
    "Solid": "Solid",
    "Some Soft Spots": "Some Soft Spots",
    "Needs Reboarding": "Needs Reboarding",
  },
  "FR — Outlets / Drainage": {
    "Clear": "Clear",
    "Partially Blocked": "Partially Blocked",
    "Blocked": "Blocked",
  },
  "FR — Upstands Condition": {
    "Good": "Good",
    "Cracking": "Cracking / Lifting",
    "Failed": "Failed",
  },
  "FR — Flashings Condition": {
    "Good": "Good",
    "Needs Attention": "Needs Attention",
    "Failed": "Failed",
  },
  "FR — Parapet Walls Condition": {
    "Good": "Good",
    "Needs Pointing": "Needs Pointing",
    "Needs Lead": "Needs Lead / Render",
    "No Parapet": "No Parapet",
  },
  "FR — Recommended System": {
    "Option 3": "Danosa Option 3 — 2 Layer Torch-On",
    "Option 2": "Danosa Option 2 — 3 Layer Torch-On",
    "Warm Deck": "Warm Deck Insulation System",
    "Repairs Only": "Repairs Only",
    "Full Strip": "Full Strip & Re-felt",
  },

  // Pitched/Tiled options
  "PT — Tile Type": {
    "Concrete": "Concrete Interlocking",
    "Clay": "Clay Plain Tile",
    "Natural Slate": "Natural Slate",
    "Man-Made Slate": "Man-Made Slate",
    "Other": "Other",
  },
  "PT — Ridge & Hip Condition": {
    "Good": "Good",
    "Cracked": "Cracked / Loose Mortar",
    "Failed": "Failed",
  },
  "PT — Ridge Type": {
    "Mortar": "Mortar Bedded",
    "Dry Ridge": "Dry Ridge System",
    "Unknown": "Unknown",
  },
  "PT — Valley Type": {
    "Lead": "Lead",
    "GRP": "GRP Trough",
    "Open": "Open Valley",
    "Closed": "Closed Valley",
    "No Valley": "No Valley",
  },
  "PT — Valleys Condition": {
    "Good": "Good",
    "Cracked": "Cracked / Lifting",
    "Failed": "Failed",
    "No Valley": "No Valley",
  },
  "PT — Felt Condition": {
    "Good": "Good",
    "Perished": "Perished in Places",
    "Failed": "Failed",
    "Not Visible": "Not Visible",
  },
  "Roof Condition": {
    "Good": "Good",
    "Fair": "Fair",
    "Poor": "Poor",
    "Critical": "Critical",
  },
  "Roof Age (Approx)": {
    "Unknown": "Unknown",
    "0-5": "0-5 years",
    "5-10": "5-10 years",
    "10-20": "10-20 years",
    "20+": "20+ years",
  },

  // Fascias options
  "FS — Current Material": {
    "Wood": "Wood",
    "UPVC": "UPVC",
    "Aluminium": "Aluminium",
    "Mixed": "Mixed",
  },
  "FS — Fascia Condition": {
    "Good": "Good",
    "Paint Peeling": "Paint Peeling / Cracking",
    "Rot": "Rot / Failed",
  },
  "FS — Soffit Condition": {
    "Good": "Good",
    "Paint Peeling": "Paint Peeling / Cracking",
    "Rot": "Rot / Failed",
  },
  "FS — Guttering Condition": {
    "Good": "Good",
    "Leaking": "Leaking Joints",
    "Broken": "Broken / Sagging",
  },
  "FS — Downpipes Condition": {
    "Good": "Good",
    "Cracked": "Cracked / Leaking",
    "Broken": "Broken",
  },
  "FS — Guttering Type": {
    "Half Round": "Half Round",
    "Square": "Square / Ogee",
    "Cast Iron": "Cast Iron",
    "Other": "Other",
  },
  "FS — Full Replacement or Repair?": {
    "Full": "Full Replacement",
    "Repair": "Repair Only",
    "TBC": "TBC",
  },

  // Chimney options
  "CH — Chimney Condition": {
    "Good": "Good",
    "Repointing": "Repointing Required",
    "Partial": "Partial Rebuild",
    "Full": "Full Rebuild Required",
  },
  "CH — Lead Flashings Condition": {
    "Good": "Good",
    "Lifting": "Lifting / Cracking",
    "Failed": "Failed",
    "No Lead": "No Lead Present",
  },
  "CH — Flaunching Condition": {
    "Good": "Good",
    "Cracked": "Cracked",
    "Failed": "Failed — Replace",
  },
  "CH — Pot / Terminal Condition": {
    "Good": "Good",
    "Damaged": "Damaged",
    "Missing": "Missing",
    "No Pot": "No Pot",
  },
};

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("OK", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }

  try {
    const { type, data } = await req.json();

    if (!type || !data) {
      return new Response(
        JSON.stringify({ error: "Missing type or data" }),
        {
          status: 400,
          headers: { "Access-Control-Allow-Origin": "*" },
        }
      );
    }

    if (type === "customer") {
      const notionData = transformCustomerData(data);
      const result = await createNotionPage(CUSTOMERS_DB_ID, notionData);
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    } else if (type === "survey") {
      const notionData = transformSurveyData(data);
      const result = await createNotionPage(JOBS_DB_ID, notionData);
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    } else {
      return new Response(
        JSON.stringify({ error: "Invalid type" }),
        {
          status: 400,
          headers: { "Access-Control-Allow-Origin": "*" },
        }
      );
    }
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
      }
    );
  }
});

// ============================================================================
// TRANSFORMATION FUNCTIONS
// ============================================================================

function transformCustomerData(data: any): any {
  const properties: any = {
    "Company Name": data.companyName || "",
    "Contact Name": data.contactName || "",
    "Phone Number": data.phone || "",
    "Email Address": data.email || "",
    Address: data.address || "",
  };
  return properties;
}

function transformSurveyData(data: any): any {
  const properties: any = {};

  // Process each field in the incoming data
  for (const [appFieldName, appValue] of Object.entries(data)) {
    // Look up the Notion property name
    const notionPropertyName =
      fieldNameMap[appFieldName as string] || appFieldName;

    // Skip null/undefined values
    if (appValue === null || appValue === undefined) continue;

    // Convert checkboxes (boolean → "__YES__"/"__NO__")
    if (typeof appValue === "boolean") {
      properties[notionPropertyName] = appValue ? "__YES__" : "__NO__";
    }
    // Handle date fields
    else if (appFieldName === "surveyDate" && appValue) {
      properties["date:Survey Date:start"] = appValue;
      properties["date:Survey Date:is_datetime"] = 0;
    }
    // Handle select fields (map values)
    else if (selectOptionMap[notionPropertyName]) {
      const mappedValue =
        selectOptionMap[notionPropertyName][String(appValue)] || String(appValue);
      properties[notionPropertyName] = mappedValue;
    }
    // Handle numeric fields
    else if (typeof appValue === "number") {
      properties[notionPropertyName] = appValue;
    }
    // Handle text fields
    else {
      properties[notionPropertyName] = String(appValue);
    }
  }

  // Handle Customer relation (customerId → Customer relation)
  if (data.customerId) {
    properties["Customer"] = data.customerId;
  }

  return properties;
}

async function createNotionPage(
  databaseId: string,
  properties: any
): Promise<any> {
  const response = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${NOTION_API_KEY}`,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28",
    },
    body: JSON.stringify({
      parent: { database_id: databaseId },
      properties: properties,
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      `Notion API error: ${result.message || JSON.stringify(result)}`
    );
  }

  return {
    success: true,
    pageId: result.id,
    url: result.url,
  };
}
