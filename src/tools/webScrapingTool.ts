import { ai, VECTORSTORE_INDEX } from '../config.js';
import { z } from 'genkit';
import { CheerioCrawler, JSDOMCrawler, RequestQueue } from 'crawlee';
import * as cheerio from 'cheerio';
import { marked } from 'marked';
import { Document as Doc } from 'genkit/retriever';
import { devLocalIndexerRef } from '@genkit-ai/dev-local-vectorstore';
import { chunk } from 'llm-chunk';

/**
 * Types and Schemas
 */
export type Operation = 'scrapeUrl' | 'crawlSite' | 'processSitemap' | 'batchScrape' | 'embedInRag';

export interface ScrapeOptions {
  depth?: number | undefined;
  selectors?: string[] | undefined;
  includeImages?: boolean | undefined;
  timeout?: number | undefined; // ms
  maxPages?: number | undefined;
  concurrency?: number | undefined;
  sameDomain?: boolean | undefined;
  renderJs?: boolean | undefined; // use JSDOMCrawler when true
}

export interface ScrapedPageMeta {
  [key: string]: string | undefined;
}

export interface ScrapedPage {
  url: string;
  loadedUrl?: string;
  statusCode?: number;
  contentType?: string;
  title?: string;
  description?: string;
  meta: ScrapedPageMeta;
  html: string;
  text: string;
  markdown?: string;
  links: string[];
  images: string[];
  fetchedAt: string; // ISO
}

export interface CrawlResult {
  startUrl: string;
  pages: ScrapedPage[];
  errors: Array<{ url: string; error: string }>;
  stats: { pagesCrawled: number; durationMs: number };
}

export interface SitemapData {
  sitemapUrl: string;
  urls: string[];
  sitemaps: string[]; // nested sitemap indexes
}

export interface BatchItemResult {
  url: string;
  success: boolean;
  page?: ScrapedPage;
  error?: string;
}

export interface BatchResult {
  results: BatchItemResult[];
}

export interface EmbeddingResult {
  success: boolean;
  documentsIndexed: number;
  sourceIds: string[];
}

const ScrapedPageSchema = z.object({
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

const CrawlResultSchema = z.object({
  startUrl: z.string().url(),
  pages: z.array(ScrapedPageSchema),
  errors: z.array(z.object({ url: z.string(), error: z.string() })),
  stats: z.object({ pagesCrawled: z.number(), durationMs: z.number() }),
});

const SitemapDataSchema = z.object({
  sitemapUrl: z.string().url(),
  urls: z.array(z.string().url()),
  sitemaps: z.array(z.string().url()),
});

const BatchResultSchema = z.object({
  results: z.array(
    z.object({
      url: z.string().url(),
      success: z.boolean(),
      page: ScrapedPageSchema.optional(),
      error: z.string().optional(),
    })
  ),
});

const EmbeddingResultSchema = z.object({
  success: z.boolean(),
  documentsIndexed: z.number(),
  sourceIds: z.array(z.string()),
});

const OptionsSchema = z
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

const InputSchema = z.object({
  operation: z.enum(['scrapeUrl', 'crawlSite', 'processSitemap', 'batchScrape', 'embedInRag']),
  url: z.string().optional(),
  urls: z.array(z.string()).optional(),
  options: OptionsSchema,
  data: z.array(ScrapedPageSchema).optional(),
  flowId: z.string().optional(),
});

const OutputEnvelopeSchema = z.object({
  success: z.boolean(),
  operation: z.string(),
  result: z.union([
    ScrapedPageSchema,
    CrawlResultSchema,
    SitemapDataSchema,
    BatchResultSchema,
    EmbeddingResultSchema,
  ]).or(z.undefined()),
  error: z.string().optional(),
  metadata: z.object({
    timestamp: z.string(),
    duration: z.number(),
    urlsProcessed: z.number().optional(),
  }),
});

const indexer = devLocalIndexerRef(VECTORSTORE_INDEX);
const defaultConcurrency = 4;
const chunkingConfig: Record<string, number | string> = {
  minLength: 800,
  maxLength: 1800,
  splitter: 'sentence',
  overlap: 120,
  delimiters: '',
};

function sanitizeOptions(input?: z.infer<typeof OptionsSchema>): ScrapeOptions {
  const out: ScrapeOptions = {};
  if (input && typeof input === 'object') {
    if (typeof input.depth === 'number') { out.depth = input.depth; }
    if (Array.isArray(input.selectors)) { out.selectors = input.selectors.filter((s): s is string => typeof s === 'string'); }
    if (typeof input.includeImages === 'boolean') { out.includeImages = input.includeImages; }
    if (typeof input.timeout === 'number') { out.timeout = input.timeout; }
    if (typeof input.maxPages === 'number') { out.maxPages = input.maxPages; }
    if (typeof input.concurrency === 'number') { out.concurrency = input.concurrency; }
    if (typeof input.sameDomain === 'boolean') { out.sameDomain = input.sameDomain; }
    if (typeof input.renderJs === 'boolean') { out.renderJs = input.renderJs; }
  }
  return out;
}

export const webScrapingTool = ai.defineTool(
  {
    name: 'webScrapingTool',
    description: 'A comprehensive web scraping tool that can scrape URLs, crawl sites, process sitemaps, batch process URLs, and embed content in RAG. Supports various scraping operations with configurable options.',
    inputSchema: InputSchema,
    outputSchema: OutputEnvelopeSchema,
  },
  async (input: z.infer<typeof InputSchema>) => {
    const startTime = Date.now();

    try {
      let result: ScrapedPage | CrawlResult | SitemapData | BatchResult | EmbeddingResult | undefined;

      switch (input.operation) {
        case 'scrapeUrl':
          if (!(typeof input.url === 'string') || input.url.trim().length === 0) {
            throw new Error('URL is required for scrapeUrl operation');
          }
          result = await scrapeUrl(input.url, sanitizeOptions(input.options));
          break;

        case 'crawlSite':
          if (!(typeof input.url === 'string') || input.url.trim().length === 0) {
            throw new Error('URL is required for crawlSite operation');
          }
          result = await crawlSite(input.url, sanitizeOptions(input.options));
          break;

        case 'processSitemap':
          if (!(typeof input.url === 'string') || input.url.trim().length === 0) {
            throw new Error('URL is required for processSitemap operation');
          }
          result = await processSitemap(input.url);
          break;

        case 'batchScrape':
          if (!Array.isArray(input.urls) || input.urls.length === 0) {
            throw new Error('URLs array is required for batchScrape operation');
          }
          result = await batchScrape(input.urls, sanitizeOptions(input.options));
          break;

        case 'embedInRag':
          if (!Array.isArray(input.data) || input.data.length === 0) {
            throw new Error('Data is required for embedInRag operation');
          }
          result = await embedInRag(input.data);
          break;

        default:
          throw new Error(`Unknown operation: ${input.operation}`);
      }

      return {
        success: true,
        operation: input.operation,
        result,
        metadata: {
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime,
          urlsProcessed: getUrlsProcessed(result, input.operation),
        },
      };

    } catch (error) {
      return {
        success: false,
        operation: input.operation,
        result: undefined,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime,
        },
      };
    }
  }
);

async function scrapeUrl(url: string, options: ScrapeOptions): Promise<ScrapedPage> {
  if (!isValidHttpUrl(url)) {
    throw new Error(`Invalid URL: ${url}`);
  }

  const includeImages = options.includeImages ?? true;
  const useJs = options.renderJs ?? false;

  let pageResult: ScrapedPage | undefined;
  if (useJs) {
    const crawler = new JSDOMCrawler({
      maxRequestRetries: 2,
      requestHandler: async ({ window, request, response, log }) => {
        try {
          const html = safeGetOuterHTML(window);
          const text = safeGetBodyText(window);
          const title = safeGetTitle(window);
          const desc1 = safeGetMetaContent(window, 'meta[name="description"]');
          const desc2 = safeGetMetaContent(window, 'meta[property="og:description"]');
          const description = (desc1 ?? desc2) ?? undefined;
          const meta: ScrapedPageMeta = collectMetaFromWindow(window);
          const baseForResolve = (typeof request.loadedUrl === 'string' && request.loadedUrl.length > 0) ? request.loadedUrl : request.url;
          const links = safeQueryAllAttributes(window, '[href]', 'href')
            .map((h) => resolveUrl(h, baseForResolve))
            .filter(Boolean);
          const images = includeImages
            ? safeQueryAllAttributes(window, 'img', 'src')
                .map((s) => resolveUrl(s, baseForResolve))
                .filter(Boolean)
            : [];

          const markdown = htmlToMarkdown(html, baseForResolve);

          const base: ScrapedPage = {
            url,
            meta,
            html,
            text,
            markdown,
            links,
            images,
            fetchedAt: new Date().toISOString(),
          };
          if (typeof request.loadedUrl === 'string' && request.loadedUrl.length > 0) { base.loadedUrl = request.loadedUrl; }
          if (typeof response?.statusCode === 'number') { base.statusCode = response.statusCode; }
          if (typeof title === 'string') { base.title = title; }
          if (typeof description === 'string') { base.description = description; }
          pageResult = base;
        } catch (e) {
          log.debug(`JSDOM parsing failed for ${url}: ${e instanceof Error ? e.message : String(e)}`);
          throw e;
        }
      },
    });
    await crawler.run([url]);
  } else {
    const crawler = new CheerioCrawler({
      maxRequestRetries: 2,
      requestHandler: async ({ $, request, response, contentType: ct, log }) => {
        try {
          const title = $('title').first().text()?.trim() ?? undefined;
          const d1 = $('meta[name="description"]').attr('content');
          const d2 = $('meta[property="og:description"]').attr('content');
          const description = (d1 ?? d2) ?? undefined;
          const meta: ScrapedPageMeta = {};
          $('meta').each((_, el) => {
            const name = $(el).attr('name') ?? $(el).attr('property');
            const content = $(el).attr('content');
            if (typeof name === 'string' && typeof content === 'string') {
              meta[name] = content;
            }
          });

          const html = $.root().html() ?? '';
          const text = $('body').text().replace(/\s+/g, ' ').trim();

          const baseUrl = request.loadedUrl ?? request.url;
          const links = $('[href]')
            .map((_, el) => $(el).attr('href'))
            .get()
            .filter((v: unknown): v is string => typeof v === 'string')
            .map((h) => resolveUrl(h, baseUrl))
            .filter(Boolean);
          const images = includeImages
            ? $('img')
                .map((_, el) => $(el).attr('src'))
                .get()
                .filter((v: unknown): v is string => typeof v === 'string')
                .map((s) => resolveUrl(s, baseUrl))
                .filter(Boolean)
            : [];

          const markdown = htmlToMarkdown(html, baseUrl);

          const base: ScrapedPage = {
            url,
            meta,
            html,
            text,
            markdown,
            links,
            images,
            fetchedAt: new Date().toISOString(),
          };
          if (typeof request.loadedUrl === 'string' && request.loadedUrl.length > 0) { base.loadedUrl = request.loadedUrl; }
          if (typeof response?.statusCode === 'number') { base.statusCode = response.statusCode; }
          const ctWrap = ct as { type?: unknown } | undefined;
          if (typeof ctWrap?.type === 'string') { base.contentType = ctWrap.type; }
          if (typeof title === 'string') { base.title = title; }
          if (typeof description === 'string') { base.description = description; }
          pageResult = base;
        } catch (e) {
          log.debug(`Cheerio parsing failed for ${url}: ${e instanceof Error ? e.message : String(e)}`);
          throw e;
        }
      },
    });
    await crawler.run([url]);
  }

  if (!pageResult) {
    throw new Error(`Failed to scrape URL: ${url}`);
  }
  return pageResult;
}

async function crawlSite(baseUrl: string, options: ScrapeOptions): Promise<CrawlResult> {
  if (!isValidHttpUrl(baseUrl)) {
    throw new Error(`Invalid URL: ${baseUrl}`);
  }

  const start = Date.now();
  const depthLimit = options.depth ?? 1;
  const maxPages = options.maxPages ?? 25;
  const sameDomain = options.sameDomain ?? true;
  const includeImages = options.includeImages ?? true;
  const useJs = options.renderJs ?? false;

  const pages: ScrapedPage[] = [];
  const errors: Array<{ url: string; error: string }> = [];
  const visited = new Set<string>();

  const queue = await RequestQueue.open();
  await queue.addRequest({ url: baseUrl, userData: { depth: 0 } });

  if (useJs) {
    const crawler = new JSDOMCrawler({
      requestQueue: queue,
      maxRequestRetries: 1,
      requestHandler: async (ctx) => {
        const { request } = ctx;
        const currentUrl: string = request.loadedUrl ?? request.url;
        visited.add(currentUrl);
        try {
          const page = extractFromJsdomContext(ctx as unknown as { window: unknown; request: { url: string; loadedUrl?: string }; response?: { statusCode?: number } }, includeImages);
          pages.push(page);

          const currentDepth: number = (request.userData?.depth as number) ?? 0;
          if (pages.length >= maxPages || currentDepth >= depthLimit) {
            return;
          }
          const nextLinks = page.links
            .filter((u) => (sameDomain ? isSameDomain(baseUrl, u) : true))
            .filter((u) => !visited.has(u));
          for (const link of nextLinks) {
            await queue.addRequest({ url: link, userData: { depth: currentDepth + 1 } });
          }
        } catch (e) {
          errors.push({ url: currentUrl, error: e instanceof Error ? e.message : String(e) });
        }
      },
    });
    await crawler.run();
  } else {
    const crawler = new CheerioCrawler({
      requestQueue: queue,
      maxRequestRetries: 1,
      requestHandler: async (ctx) => {
        const { request } = ctx;
        const currentUrl: string = request.loadedUrl ?? request.url;
        visited.add(currentUrl);
        try {
          const page = extractFromCheerioContext(ctx as unknown as { $: cheerio.CheerioAPI; request: { url: string; loadedUrl?: string }; response?: { statusCode?: number }; contentType?: string }, includeImages);
          pages.push(page);

          const currentDepth: number = (request.userData?.depth as number) ?? 0;
          if (pages.length >= maxPages || currentDepth >= depthLimit) {
            return;
          }
          const nextLinks = page.links
            .filter((u) => (sameDomain ? isSameDomain(baseUrl, u) : true))
            .filter((u) => !visited.has(u));
          for (const link of nextLinks) {
            await queue.addRequest({ url: link, userData: { depth: currentDepth + 1 } });
          }
        } catch (e) {
          errors.push({ url: currentUrl, error: e instanceof Error ? e.message : String(e) });
        }
      },
    });
    await crawler.run();
  }

  return {
    startUrl: baseUrl,
    pages,
    errors,
    stats: { pagesCrawled: pages.length, durationMs: Date.now() - start },
  };
}

async function processSitemap(sitemapUrl: string): Promise<SitemapData> {
  if (!isValidHttpUrl(sitemapUrl)) {
    throw new Error(`Invalid URL: ${sitemapUrl}`);
  }
  const res = await fetch(sitemapUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch sitemap: ${res.status} ${res.statusText}`);
  }
  const xml = await res.text();
  const $ = cheerio.load(xml, { xml: true });

  const urls: string[] = [];
  const sitemaps: string[] = [];

  $('urlset > url > loc').each((_, el) => {
    const u = $(el).text().trim();
    if (isValidHttpUrl(u)) {
      urls.push(u);
    }
  });
  $('sitemapindex > sitemap > loc').each((_, el) => {
    const u = $(el).text().trim();
    if (isValidHttpUrl(u)) {
      sitemaps.push(u);
    }
  });

  return { sitemapUrl, urls, sitemaps };
}

async function batchScrape(urls: string[], options: ScrapeOptions): Promise<BatchResult> {
  const deduped: string[] = Array.from(new Set(urls.filter((u) => typeof u === 'string' && u.trim().length > 0)));
  const conc = Math.max(1, Math.min(options.concurrency ?? defaultConcurrency, 16));

  const results: BatchItemResult[] = [];
  let index = 0;

  async function worker(): Promise<void> {
    while (index < deduped.length) {
      const i = index++;
      const urlStr = deduped[i]!;
      try {
        const page = await scrapeUrl(urlStr, options);
        results.push({ url: urlStr, success: true, page });
      } catch (e) {
        results.push({ url: urlStr, success: false, error: e instanceof Error ? e.message : String(e) });
      }
    }
  }

  await Promise.all(Array.from({ length: conc }, () => worker()));
  return { results };
}

async function embedInRag(data: Array<z.infer<typeof ScrapedPageSchema>>): Promise<EmbeddingResult> {
  // Choose content: prefer markdown, fallback to text
  const documents: Array<ReturnType<typeof Doc.fromText>> = [];
  const sourceIds: string[] = [];

  for (const page of data) {
    const content = typeof page.markdown === 'string' && page.markdown.trim().length > 0 ? page.markdown : page.text;
    const chunksRes = await ai.run('chunk-webscrape', async () => chunk(content, chunkingConfig));
    const chunks = toStringArray(chunksRes);
    chunks.forEach((c, idx) => {
      const sourceId = `${page.url}#${idx}`;
      sourceIds.push(sourceId);
      documents.push(
        Doc.fromText(c, {
          sourceId,
          metadata: {
            url: page.url,
            title: page.title ?? '',
            description: page.description ?? '',
          },
        })
      );
    });
  }

  await ai.index({ indexer, documents });
  return { success: true, documentsIndexed: documents.length, sourceIds };
}

function getUrlsProcessed(
  result: ScrapedPage | CrawlResult | SitemapData | BatchResult | EmbeddingResult | undefined,
  operation: string
): number | undefined {
  switch (operation) {
    case 'scrapeUrl':
      return 1;
    case 'crawlSite':
      return (result as CrawlResult | undefined)?.pages?.length ?? 0;
    case 'batchScrape':
      return (result as BatchResult | undefined)?.results?.length ?? 0;
    case 'processSitemap':
      return (result as SitemapData | undefined)?.urls?.length ?? 0;
    default:
      return undefined;
  }
}

function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function resolveUrl(href: string, base: string): string | '' {
  if (!href || href.startsWith('javascript:') || href.startsWith('mailto:')) {
    return '';
  }
  try {
    return new URL(href, base).toString();
  } catch {
    return '';
  }
}

function isSameDomain(a: string, b: string): boolean {
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    return ua.host === ub.host;
  } catch {
    return false;
  }
}

function htmlToMarkdown(html: string, baseUrl: string): string {
  // Simple, conservative HTML -> Markdown conversion using Cheerio traversal
  const $ = cheerio.load(html);
  const lines: string[] = [];

  $('script, style, noscript').remove();

  $('h1, h2, h3, h4, h5, h6, p, li, a, code, pre, table, th, td').each((_, el) => {
    const tag = el.tagName?.toLowerCase();
    if (!tag) {
      return;
    }
    if (tag.startsWith('h')) {
      const level = Math.min(6, Math.max(1, Number(tag[1]) || 1));
      lines.push(`${'#'.repeat(level)} ${$(el).text().trim()}`);
      lines.push('');
    } else if (tag === 'p') {
      lines.push($(el).text().trim());
      lines.push('');
    } else if (tag === 'li') {
      lines.push(`- ${$(el).text().trim()}`);
    } else if (tag === 'a') {
      const href = $(el).attr('href');
      let url = '';
      if (typeof href === 'string' && href.trim().length > 0) {
        url = resolveUrl(href, baseUrl) ?? '';
      }
      const text = $(el).text().trim() || url;
      if (url) {
        lines.push(`[${text}](${url})`);
      }
    } else if (tag === 'code') {
      lines.push('`' + $(el).text() + '`');
    } else if (tag === 'pre') {
      lines.push('```');
      lines.push($(el).text());
      lines.push('```');
    } else if (tag === 'table') {
      // very naive table: output text content
      lines.push($(el).text().trim());
      lines.push('');
    }
  });

  const md = lines.join('\n');
  // Use marked to pre-parse for validation (ignore output)
  try { marked.parse(md); } catch { /* noop */ }
  return md.trim();
}

function extractFromCheerioContext(
  ctx: { $: cheerio.CheerioAPI; request: { url: string; loadedUrl?: string }; response?: { statusCode?: number }; contentType?: string },
  includeImages: boolean
): ScrapedPage {
  const { $, request, response, contentType } = ctx;
  const title = $('title').first().text()?.trim() ?? undefined;
  const d1 = $('meta[name="description"]').attr('content');
  const d2 = $('meta[property="og:description"]').attr('content');
  const description = (d1 ?? d2) ?? undefined;
  const meta: ScrapedPageMeta = {};
  $('meta').each((_, el) => {
    const name = $(el).attr('name') ?? $(el).attr('property');
    const content = $(el).attr('content');
    if (typeof name === 'string' && typeof content === 'string') {
      meta[name] = content;
    }
  });
  const html = $.root().html() ?? '';
  const text = $('body').text().replace(/\s+/g, ' ').trim();
  const baseUrl = request.loadedUrl ?? request.url;
  const links = $('[href]')
    .map((_, el) => $(el).attr('href'))
    .get()
    .filter((v: unknown): v is string => typeof v === 'string')
    .map((h) => resolveUrl(h, baseUrl))
    .filter(Boolean);
  const images = includeImages
    ? $('img')
        .map((_, el) => $(el).attr('src'))
        .get()
        .filter((v: unknown): v is string => typeof v === 'string')
        .map((s) => resolveUrl(s, baseUrl))
        .filter(Boolean)
    : [];

  const page: ScrapedPage = {
    url: request.url,
    meta,
    html,
    text,
    markdown: htmlToMarkdown(html, baseUrl),
    links,
    images,
    fetchedAt: new Date().toISOString(),
  };
  if (typeof request.loadedUrl === 'string' && request.loadedUrl.length > 0) {
    page.loadedUrl = request.loadedUrl;
  }
  if (typeof response?.statusCode === 'number') {
    page.statusCode = response.statusCode;
  }
  if (typeof contentType === 'string') {
    page.contentType = contentType;
  }
  if (typeof title === 'string') {
    page.title = title;
  }
  if (typeof description === 'string') {page.description = description;}
  return page;
}

// Safe DOM helper utilities (avoid DOM lib types; use unknown with guards)
function mGetAttribute(el: unknown, name: string): string | null {
  if (typeof el === 'object' && el !== null && 'getAttribute' in el) {
  const getter = (el as { getAttribute?: unknown }).getAttribute as Function | undefined;
    if (typeof getter === 'function') {
  const res = Function.prototype.call.call(getter, el as object, name) as unknown;
      if (typeof res === 'string') { return res; }
      if (res === null) { return null; }
      return null;
    }
  }
  return null;
}

function safeQueryAll(win: unknown, selector: string): unknown[] {
  const doc = (win as { document?: unknown }).document as { querySelectorAll?: unknown } | undefined;
  if (typeof doc === 'object' && doc !== null && 'querySelectorAll' in doc) {
  const qsa = (doc as { querySelectorAll?: unknown }).querySelectorAll as Function | undefined;
    if (typeof qsa === 'function') {
      try {
  const nodeListUnknown = Function.prototype.call.call(qsa, doc as object, selector) as unknown;
        const arrLike = nodeListUnknown as { length?: number } & { [index: number]: unknown };
        const out: unknown[] = [];
        const len = typeof arrLike?.length === 'number' ? arrLike.length : 0;
        for (let i = 0; i < len; i++) {
          if (i in arrLike) {
            out.push(arrLike[i]);
          }
        }
        return out;
      } catch {
        return [];
      }
    }
  }
  return [];
}

function safeQueryAllAttributes(win: unknown, selector: string, attr: string): string[] {
  return safeQueryAll(win, selector)
    .map((el) => mGetAttribute(el, attr))
    .filter((v): v is string => typeof v === 'string');
}

function safeGetOuterHTML(win: unknown): string {
  const doc = (win as { document?: unknown }).document as { documentElement?: { outerHTML?: string | null } | null } | undefined;
  const html = doc?.documentElement?.outerHTML;
  return typeof html === 'string' ? html : '';
}

function safeGetBodyText(win: unknown): string {
  const doc = (win as { document?: unknown }).document as { body?: { textContent?: string | null } | null } | undefined;
  const text = doc?.body?.textContent;
  return typeof text === 'string' ? text.replace(/\s+/g, ' ').trim() : '';
}

function safeGetTitle(win: unknown): string | undefined {
  const doc = (win as { document?: unknown }).document as { title?: string } | undefined;
  return typeof doc?.title === 'string' ? doc.title : undefined;
}

function safeGetMetaContent(win: unknown, selector: string): string | null {
  const doc = (win as { document?: unknown }).document as { querySelector?: unknown } | undefined;
  if (typeof doc === 'object' && doc !== null && 'querySelector' in doc) {
  const qs = (doc as { querySelector?: unknown }).querySelector as Function | undefined;
    if (typeof qs === 'function') {
      try {
  const node = Function.prototype.call.call(qs, doc as object, selector) as unknown;
        return mGetAttribute(node, 'content');
      } catch {
        return null;
      }
    }
  }
  return null;
}

function collectMetaFromWindow(win: unknown): ScrapedPageMeta {
  const out: ScrapedPageMeta = {};
  const nodes = safeQueryAll(win, 'meta');
  for (const n of nodes) {
    const name = mGetAttribute(n, 'name') ?? mGetAttribute(n, 'property');
    const content = mGetAttribute(n, 'content') ?? undefined;
    if (typeof name === 'string' && typeof content === 'string') {
      out[name] = content;
    }
  }
  return out;
}

function extractFromJsdomContext(
  ctx: { window: unknown; request: { url: string; loadedUrl?: string }; response?: { statusCode?: number } },
  includeImages: boolean
): ScrapedPage {
  const { window, request, response } = ctx;
  const html = safeGetOuterHTML(window);
  const text = safeGetBodyText(window);
  const title = safeGetTitle(window);
  const jd1 = safeGetMetaContent(window, 'meta[name="description"]');
  const jd2 = safeGetMetaContent(window, 'meta[property="og:description"]');
  const description = (jd1 ?? jd2) ?? undefined;
  const meta: ScrapedPageMeta = collectMetaFromWindow(window);
  const baseUrl = (typeof request.loadedUrl === 'string' && request.loadedUrl.length > 0) ? request.loadedUrl : request.url;
  const links = safeQueryAllAttributes(window, '[href]', 'href')
    .map((h) => resolveUrl(h, baseUrl))
    .filter(Boolean);
  const images = includeImages
    ? safeQueryAllAttributes(window, 'img', 'src')
        .map((s) => resolveUrl(s, baseUrl))
        .filter(Boolean)
    : [];

  const page: ScrapedPage = {
    url: request.url,
    meta,
    html,
    text,
    markdown: htmlToMarkdown(html, baseUrl),
    links,
    images,
    fetchedAt: new Date().toISOString(),
  };
  if (typeof request.loadedUrl === 'string' && request.loadedUrl.length > 0) {
    page.loadedUrl = request.loadedUrl;
  }
  if (typeof response?.statusCode === 'number') {
    page.statusCode = response.statusCode;
  }
  if (typeof title === 'string') {
    page.title = title;
  }
  if (typeof description === 'string') {
    page.description = description;
  }
  return page;
}

// collectMetaFromWindow handles meta extraction for JSDOM path

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === 'string');
  }
  if (value === undefined || value === null) {
    return [];
  }
  return [String(value)];
}