import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const NOTION_TOKEN = Deno.env.get("NOTION_API_KEY") || "";
const CUSTOMERS_DB = "d65bd480-6feb-427d-ac3d-a44f096a666a";
const JOBS_DB = "aa3a8478-a70a-40d7-8c76-22f976e0df3a";

serve(async (req) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response("OK", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type, apikey",
      },
    });
  }

  try {
    const body = await req.json();
    const { type, data } = body;

    if (!type || !data) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing type or data" }),
        { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    if (type === "customer") {
      // Create customer in Notion
      const response = await fetch("https://api.notion.com/v1/pages", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${NOTION_TOKEN}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          parent: { database_id: CUSTOMERS_DB },
          properties: {
            Name: { title: [{ text: { content: data.name || "Unknown" } }] },
            Phone: { phone_number: data.phone || "" },
            Email: { email: data.email || "" },
            Address: { rich_text: [{ text: { content: data.address || "" } }] },
          },
        }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        return new Response(
          JSON.stringify({
            success: false,
            error: result.message || "Failed to create customer",
          }),
          { status: response.status, headers: { "Access-Control-Allow-Origin": "*" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, id: result.id }),
        { headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    if (type === "survey") {
      // Create job in Notion
      const response = await fetch("https://api.notion.com/v1/pages", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${NOTION_TOKEN}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          parent: { database_id: JOBS_DB },
          properties: {
            "Job Title": {
              title: [{ text: { content: data.jobTitle || "Survey" } }],
            },
            "Status": { status: { name: "Survey Complete" } },
            "Survey Type": { select: { name: data.surveyType || "General" } },
            "Property Address": {
              rich_text: [
                { text: { content: data.propertyAddress || "Unknown" } },
              ],
            },
            "Customer ID": {
              rich_text: [{ text: { content: data.customerId || "" } }],
            },
          },
        }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        return new Response(
          JSON.stringify({
            success: false,
            error: result.message || "Failed to create job",
          }),
          { status: response.status, headers: { "Access-Control-Allow-Origin": "*" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, id: result.id }),
        { headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Unknown type" }),
      { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Server error",
      }),
      { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
});
