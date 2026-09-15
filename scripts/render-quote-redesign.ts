import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildQuotePdfBuffer } from "../lib/quote-engine";
import { getMockBundle } from "../lib/mock-data";

async function main() {
  const bundle = getMockBundle("job-2");
  if (!bundle?.quote) throw new Error("Mock quote job-2 is unavailable.");

  const outputDir = path.resolve("output/pdf");
  await mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, "quote-redesign-preview.pdf");
  await writeFile(outputPath, await buildQuotePdfBuffer(bundle, bundle.quote));
  console.log(outputPath);
}

void main();
