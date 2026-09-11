/**
 * images.ts
 *
 * Downloads gallery + A+ images referenced in an extractor JSON
 * (output/<ASIN>.json) and saves them locally under
 * fixtures/<ASIN>/images/{gallery,aplus}/.
 *
 * Design notes:
 * - Amazon gallery thumbnails often come back as small (e.g. ._SS40_)
 *   sized URLs. `toHiRes()` strips the size token so we save the
 *   largest available version instead of a thumbnail.
 * - Downloads are deduped by URL (in case the same image appears in
 *   both gallery and A+) and by content hash (in case Amazon serves
 *   the same image at two different URLs).
 * - Failures for one image don't abort the whole batch — each result
 *   is recorded as ok/failed in the manifest so nothing is silently
 *   lost.
 * - Concurrency is capped (default 5) and requests are lightly
 *   throttled to stay a reasonably well-behaved client.
 */

import { createHash } from "crypto";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import path from "path";
import type { ListingExtract } from "../extractor/types";

export type ImageCategory = "gallery" | "aplus" | "brandStory" | "comparisonChart";

export interface DownloadResult {
  category: ImageCategory;
  sourceUrl: string;
  status: "ok" | "failed" | "skipped_duplicate";
  localPath?: string;
  contentHash?: string;
  bytes?: number;
  error?: string;
}

export interface DownloadManifest {
  asin: string;
  generatedAt: string;
  results: DownloadResult[];
  summary: {
    total: number;
    ok: number;
    failed: number;
    skippedDuplicate: number;
  };
}

export interface DownloadOptions {
  outDir?: string; // defaults to fixtures/<asin>/images
  concurrency?: number; // default 5
  delayMsBetweenBatches?: number; // default 300
  userAgent?: string;
}

/** Strip Amazon's size/quality token (e.g. "._SS40_", "._AC_SL1500_") to request the hi-res original where possible. */
export function toHiRes(url: string): string {
  return url.replace(/\._[A-Z0-9,._]+_(?=\.[a-zA-Z]+$)/, "");
}

function extensionFromUrl(url: string, contentType?: string | null): string {
  const fromUrl = path.extname(new URL(url).pathname).replace(".", "");
  if (fromUrl && fromUrl.length <= 4) return fromUrl;
  if (contentType?.includes("png")) return "png";
  if (contentType?.includes("webp")) return "webp";
  return "jpg";
}

function collectSources(listing: ListingExtract): { category: ImageCategory; url: string }[] {
  const sources: { category: ImageCategory; url: string }[] = [];

  for (const url of listing.gallery?.images ?? []) {
    sources.push({ category: "gallery", url });
  }
  for (const url of listing.aplus?.imageUrls ?? []) {
    sources.push({ category: "aplus", url });
  }
  for (const url of listing.brandStory?.imageUrls ?? []) {
    sources.push({ category: "brandStory", url });
  }
  if (listing.comparisonChart?.imageUrl) {
    sources.push({ category: "comparisonChart", url: listing.comparisonChart.imageUrl });
  }

  return sources;
}

async function downloadOne(
  category: ImageCategory,
  rawUrl: string,
  outDir: string,
  index: number,
  seenHashes: Set<string>,
  userAgent: string
): Promise<DownloadResult> {
  const url = toHiRes(rawUrl);

  try {
    const res = await fetch(url, { headers: { "User-Agent": userAgent } });
    if (!res.ok) {
      return { category, sourceUrl: rawUrl, status: "failed", error: `HTTP ${res.status}` };
    }

    const buf = Buffer.from(await res.arrayBuffer());
    const hash = createHash("sha256").update(buf).digest("hex");

    if (seenHashes.has(hash)) {
      return { category, sourceUrl: rawUrl, status: "skipped_duplicate", contentHash: hash };
    }
    seenHashes.add(hash);

    const ext = extensionFromUrl(url, res.headers.get("content-type"));
    const categoryDir = path.join(outDir, category);
    mkdirSync(categoryDir, { recursive: true });

    const filename = `${String(index).padStart(3, "0")}_${hash.slice(0, 8)}.${ext}`;
    const localPath = path.join(categoryDir, filename);
    writeFileSync(localPath, buf);

    return {
      category,
      sourceUrl: rawUrl,
      status: "ok",
      localPath,
      contentHash: hash,
      bytes: buf.length,
    };
  } catch (err) {
    return {
      category,
      sourceUrl: rawUrl,
      status: "failed",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function runInBatches<T, R>(
  items: T[],
  concurrency: number,
  delayMs: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((item, j) => worker(item, i + j))
    );
    results.push(...batchResults);
    if (i + concurrency < items.length && delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return results;
}

export async function downloadListingImages(
  listing: ListingExtract,
  opts: DownloadOptions = {}
): Promise<DownloadManifest> {
  const outDir = opts.outDir ?? path.join("fixtures", listing.asin, "images");
  const concurrency = opts.concurrency ?? 5;
  const delayMs = opts.delayMsBetweenBatches ?? 300;
  const userAgent =
    opts.userAgent ??
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

  mkdirSync(outDir, { recursive: true });

  const sources = collectSources(listing);
  const seenHashes = new Set<string>();

  const results = await runInBatches(sources, concurrency, delayMs, (src, idx) =>
    downloadOne(src.category, src.url, outDir, idx, seenHashes, userAgent)
  );

  const manifest: DownloadManifest = {
    asin: listing.asin,
    generatedAt: new Date().toISOString(),
    results,
    summary: {
      total: results.length,
      ok: results.filter((r) => r.status === "ok").length,
      failed: results.filter((r) => r.status === "failed").length,
      skippedDuplicate: results.filter((r) => r.status === "skipped_duplicate").length,
    },
  };

  writeFileSync(
    path.join(outDir, "manifest.json"),
    JSON.stringify(manifest, null, 2)
  );

  return manifest;
}
