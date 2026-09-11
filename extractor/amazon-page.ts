/**
 * amazon-page.ts
 *
 * Fetches a single Amazon product page by ASIN and parses the
 * "core" listing fields (title, bullets, description, brand,
 * rating, reviewCount, product details, variations, parentAsin).
 *
 * NOTE ON SELECTORS: Amazon frequently changes DOM structure and
 * serves different markup per locale/A-B test. The selectors below
 * are starting points based on commonly-seen ids/classes as of 2026
 * (#productTitle, #feature-bullets, #productDescription, etc.) —
 * verify against a live fetch before relying on them, and keep a
 * fallback path (regex on window.__initialProduct / embedded JSON)
 * since Amazon often ships structured data in inline <script> tags.
 *
 * NOTE ON COMPLIANCE: Respect Amazon's robots.txt and Terms of
 * Service, rate-limit requests, use your own IP/proxy pool
 * responsibly, and don't scrape at a volume/frequency that could be
 * considered abusive. This scaffold intentionally does not include
 * anti-bot evasion (headless-browser fingerprint spoofing, CAPTCHA
 * solving, etc.) — build compliantly or use an official/paid data
 * provider (Rainforest API, Oxylabs, Keepa) for production use.
 */

import * as cheerio from "cheerio";
import type { ListingExtract, BlockStatus } from "./types";

export interface FetchOptions {
  marketplace?: "US" | "UK" | "DE" | "CA";
  userAgent?: string;
  html?: string; // pass pre-fetched HTML (e.g. from a fixture) to skip the network call
}

const DOMAIN_BY_MARKETPLACE: Record<string, string> = {
  US: "https://www.amazon.com",
  UK: "https://www.amazon.co.uk",
  DE: "https://www.amazon.de",
  CA: "https://www.amazon.ca",
};

export async function fetchListingHtml(
  asin: string,
  opts: FetchOptions = {}
): Promise<string> {
  if (opts.html) return opts.html;

  const domain = DOMAIN_BY_MARKETPLACE[opts.marketplace ?? "US"];
  const url = `${domain}/dp/${asin}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        opts.userAgent ??
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }

  return res.text();
}

export function parseListing(
  asin: string,
  html: string,
  marketplace: "US" | "UK" | "DE" | "CA" = "US"
): ListingExtract {
  const $ = cheerio.load(html);

  const title = $("#productTitle").text().trim() || null;

  const bullets = $("#feature-bullets ul li span.a-list-item")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean);

  const brand =
    $("#bylineInfo").text().trim().replace(/^Visit the |^Brand:\s*/i, "").trim() ||
    null;

  const ratingText = $("#acrPopover").attr("title") || $("span.a-icon-alt").first().text();
  const rating = ratingText ? parseFloat(ratingText.replace(/[^\d.]/g, "")) : null;

  const reviewCountText = $("#acrCustomerReviewText").first().text();
  const reviewCount = reviewCountText
    ? parseInt(reviewCountText.replace(/[^\d]/g, ""), 10)
    : null;

  const descriptionText = $("#productDescription").text().trim() || null;

  const galleryImages = $("#altImages img")
    .map((_, el) => $(el).attr("src") || "")
    .get()
    .filter(Boolean);

  const hasVideo = $("#altImages .videoBlock").length > 0;

  const aplusModuleCount = $("#aplus, #aplus_feature_div .aplus-module").length;
  const aplusImageUrls = $("#aplus img, #aplus3p_feature_div img")
    .map((_, el) => $(el).attr("src") || $(el).attr("data-src") || "")
    .get()
    .filter(Boolean);

  const variationAsins = $("#variation_color_name li, #variation_size_name li")
    .map((_, el) => $(el).attr("data-defaultasin") || "")
    .get()
    .filter(Boolean);

  const status = (present: boolean, weakIf?: boolean): BlockStatus =>
    !present ? "MISSING" : weakIf ? "WEAK" : "PRESENT";

  const result: ListingExtract = {
    asin,
    marketplace,
    brand,
    rating,
    reviewCount,
    bsrMain: {},
    bsrSub: {},
    title: { status: status(!!title), content: title },
    bullets: {
      status: status(bullets.length > 0, bullets.length < 5),
      count: bullets.length,
      content: bullets,
    },
    description: {
      status: status(!!descriptionText),
      content: descriptionText,
    },
    productDetails: {
      status: "NOT_ACCESSIBLE",
      ingredients: null,
      directions: null,
      warnings: null,
    },
    gallery: {
      status: status(galleryImages.length > 0, galleryImages.length < 5),
      images: galleryImages,
      hasVideo,
      videoUrls: [],
    },
    aplus: {
      status: status(aplusModuleCount > 0),
      moduleCount: aplusModuleCount,
      imageUrls: aplusImageUrls,
      isPremium: aplusModuleCount > 5,
    },
    brandStory: { status: "NOT_ACCESSIBLE", imageUrls: [] },
    comparisonChart: { status: "NOT_ACCESSIBLE", imageUrl: null },
    variations: {
      status: status(variationAsins.length > 0),
      asins: variationAsins,
    },
    backendKeywords: { status: "NOT_ACCESSIBLE" },
    parentAsin: null,
    scrapedAt: new Date().toISOString(),
  };

  return result;
}

export async function extractListing(
  asin: string,
  opts: FetchOptions = {}
): Promise<ListingExtract> {
  const html = await fetchListingHtml(asin, opts);
  return parseListing(asin, html, opts.marketplace ?? "US");
}
