/**
 * Usage:
 *   npx tsx downloader/run.ts output/B0B2RM68G2.json
 *   npx tsx downloader/run.ts output/B0B2RM68G2.json --concurrency 8 --delay 500
 *
 * Reads an extractor JSON (produced by extractor/run.ts), downloads
 * every gallery/A+/brandStory/comparisonChart image it references,
 * and writes fixtures/<ASIN>/images/manifest.json with per-image
 * status (ok / failed / skipped_duplicate).
 */
import { readFileSync } from "fs";
import { downloadListingImages } from "./images";
import type { ListingExtract } from "../extractor/types";

function parseFlag(args: string[], name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] : undefined;
}

async function main() {
  const args = process.argv.slice(2);
  const jsonPath = args[0];

  if (!jsonPath) {
    console.error("Usage: run.ts <path-to-extractor-json> [--concurrency N] [--delay MS]");
    process.exit(1);
  }

  const listing: ListingExtract = JSON.parse(readFileSync(jsonPath, "utf-8"));

  const concurrency = Number(parseFlag(args, "concurrency")) || undefined;
  const delayMsBetweenBatches = Number(parseFlag(args, "delay")) || undefined;

  const manifest = await downloadListingImages(listing, {
    concurrency,
    delayMsBetweenBatches,
  });

  console.log(
    `ASIN ${manifest.asin}: ${manifest.summary.ok} ok, ` +
      `${manifest.summary.failed} failed, ` +
      `${manifest.summary.skippedDuplicate} duplicates skipped ` +
      `(of ${manifest.summary.total} total).`
  );

  const failed = manifest.results.filter((r) => r.status === "failed");
  if (failed.length) {
    console.log("\nFailed downloads:");
    for (const f of failed) {
      console.log(`  [${f.category}] ${f.sourceUrl} — ${f.error}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
