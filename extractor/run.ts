/**
 * Usage:
 *   npx tsx extractor/run.ts B0B2RM68G2 --fixture fixtures/B0B2RM68G2/page.html
 *   npx tsx extractor/run.ts B0B2RM68G2                 # live fetch (respect ToS/rate limits)
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { extractListing, parseListing } from "./amazon-page";

async function main() {
  const [asin, flag, fixturePath] = process.argv.slice(2);

  if (!asin) {
    console.error("Usage: run.ts <ASIN> [--fixture path/to/page.html]");
    process.exit(1);
  }

  const listing =
    flag === "--fixture" && fixturePath
      ? parseListing(asin, readFileSync(fixturePath, "utf-8"))
      : await extractListing(asin);

  mkdirSync("output", { recursive: true });
  const outPath = `output/${asin}.json`;
  writeFileSync(outPath, JSON.stringify(listing, null, 2));
  console.log(`Wrote ${outPath}`);
  console.log(JSON.stringify(listing, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
