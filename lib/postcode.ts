export type PostcodeLookupResult = {
  address_line_1?: string;
  town?: string;
  county?: string;
};

export async function lookupPostcode(postcode: string): Promise<PostcodeLookupResult | null> {
  if (!postcode || postcode.trim().length < 5) return null;

  const clean = postcode.trim().toUpperCase().replace(/\s+/g, "");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(clean)}`, {
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!response.ok) return null;
    const data = (await response.json()) as {
      status?: number;
      result?: {
        postcode?: string;
        admin_ward?: string | null;
        parish?: string | null;
        admin_county?: string | null;
        admin_district?: string | null;
      };
    };

    if (data.status !== 200 || !data.result) return null;

    return {
      address_line_1: data.result.postcode ?? undefined,
      town: data.result.admin_ward || data.result.parish || data.result.admin_district || "",
      county: data.result.admin_county || data.result.admin_district || ""
    };
  } catch (error) {
    console.warn("Postcode lookup failed, continuing:", error);
    return null;
  }
}
