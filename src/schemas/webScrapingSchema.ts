import { z } from 'genkit';

export const ScrapedPageSchema = z.object({
  url: z.string().url(),
  loadedUrl: z.string().url().optional(),
  statusCode: z.number().optional(),
  contentType: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  meta: z.record(z.string().or(z.undefined())),
  html: z.string(),
  text: z.string(),
  markdown: z.string().optional(),
  links: z.array(z.string()),
  images: z.array(z.string()),
  fetchedAt: z.string(),
});

export const CrawlResultSchema = z.object({
  startUrl: z.string().url(),
  pages: z.array(ScrapedPageSchema),
  errors: z.array(z.object({ url: z.string(), error: z.string() })),
  stats: z.object({ pagesCrawled: z.number(), durationMs: z.number() }),
});

export const SitemapDataSchema = z.object({
  sitemapUrl: z.string().url(),
  urls: z.array(z.string().url()),
  sitemaps: z.array(z.string().url()),
});

export const BatchResultSchema = z.object({
  results: z.array(
    z.object({
      url: z.string().url(),
      success: z.boolean(),
      page: ScrapedPageSchema.optional(),
      error: z.string().optional(),
    })
  ),
});

export const EmbeddingResultSchema = z.object({
  success: z.boolean(),
  documentsIndexed: z.number(),
  sourceIds: z.array(z.string()),
});

export const WebScrapingOptionsSchema = z
  .object({
    depth: z.number().optional(),
    selectors: z.array(z.string()).optional(),
    includeImages: z.boolean().optional(),
    timeout: z.number().optional(),
    maxPages: z.number().optional(),
    concurrency: z.number().optional(),
    sameDomain: z.boolean().optional(),
    renderJs: z.boolean().optional(),
  })
  .optional();

export const WebScrapingInputSchema = z.object({
  operation: z.enum(['scrapeUrl', 'crawlSite', 'processSitemap', 'batchScrape', 'embedInRag']),
  url: z.string().optional(),
  urls: z.array(z.string()).optional(),
  options: WebScrapingOptionsSchema,
  data: z.array(ScrapedPageSchema).optional(),
  flowId: z.string().optional(),
});

export const WebScrapingOutputSchema = z.object({
  success: z.boolean(),
  operation: z.string(),
  result: z
    .union([
      ScrapedPageSchema,
      CrawlResultSchema,
      SitemapDataSchema,
      BatchResultSchema,
      EmbeddingResultSchema,
    ])
    .or(z.undefined()),
  error: z.string().optional(),
  metadata: z.object({
    timestamp: z.string(),
    duration: z.number(),
    urlsProcessed: z.number().optional(),
  }),
});

export type WebScrapingInput = z.infer<typeof WebScrapingInputSchema>;
export type WebScrapingOutput = z.infer<typeof WebScrapingOutputSchema>;
