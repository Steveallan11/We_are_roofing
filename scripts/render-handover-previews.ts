import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildJobCompletionPdf, buildWarrantyCertificatePdf } from "../lib/job-handover-engine";
import { getMockBundle } from "../lib/mock-data";

async function main() {
  const bundle = getMockBundle("job-3");
  if (!bundle) throw new Error("Mock job is unavailable.");
  bundle.job.completed_at = bundle.job.completed_at || new Date().toISOString();
  const outputDir = path.resolve("output/pdf");
  await mkdir(outputDir, { recursive: true });
  await Promise.all([
    writeFile(path.join(outputDir, "job-completion-sheet-preview.pdf"), await buildJobCompletionPdf(bundle)),
    writeFile(path.join(outputDir, "workmanship-warranty-preview.pdf"), await buildWarrantyCertificatePdf(bundle))
  ]);
}

void main();
