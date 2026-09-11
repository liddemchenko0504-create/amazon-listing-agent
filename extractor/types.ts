export type BlockStatus = "PRESENT" | "WEAK" | "MISSING" | "NOT_ACCESSIBLE";

export interface ListingExtract {
  asin: string;
  marketplace: "US" | "UK" | "DE" | "CA";
  brand: string | null;
  rating: number | null;
  reviewCount: number | null;
  bsrMain: Record<string, unknown>;
  bsrSub: Record<string, unknown>;
  title: { status: BlockStatus; content: string | null };
  bullets: { status: BlockStatus; count: number; content: string[] };
  description: { status: BlockStatus; content: string | null };
  productDetails: {
    status: BlockStatus;
    ingredients: string | null;
    directions: string | null;
    warnings: string | null;
  };
  gallery: {
    status: BlockStatus;
    images: string[];
    hasVideo: boolean;
    videoUrls: string[];
  };
  aplus: {
    status: BlockStatus;
    moduleCount: number;
    imageUrls: string[];
    isPremium: boolean;
  };
  brandStory: { status: BlockStatus; imageUrls: string[] };
  comparisonChart: { status: BlockStatus; imageUrl: string | null };
  variations: { status: BlockStatus; asins: string[] };
  backendKeywords: { status: "NOT_ACCESSIBLE" };
  parentAsin: string | null;
  scrapedAt: string;
}
