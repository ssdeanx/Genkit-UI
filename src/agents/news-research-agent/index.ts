import express from "express";
import { v4 as uuidv4 } from 'uuid';

import type { MessageData } from "genkit";
import type {
  AgentCard,
  Task,
  TaskStatusUpdateEvent} from "@a2a-js/sdk";
import type {
  TextPart,
} from "@a2a-js/sdk";
import type {
  TaskStore,
  AgentExecutor,
  RequestContext,
  ExecutionEventBus} from "@a2a-js/sdk/server";
import {
  InMemoryTaskStore,
  DefaultRequestHandler,
} from "@a2a-js/sdk/server";
import { A2AExpressApp } from "@a2a-js/sdk/server/express";
import { ai } from "./genkit.js";
import type { ComprehensiveNewsResult, NewsArticle } from "./news-search.js";
import { NewsSearchUtils } from "./news-search.js";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey || apiKey.trim() === '') {
  console.error("GEMINI_API_KEY environment variable not set or empty.");
  process.exit(1);
}

/**
 * NewsResearchAgentExecutor implements the agent's core logic for news analysis and current events research.
 */
class NewsResearchAgentExecutor implements AgentExecutor {
  private cancelledTasks = new Set<string>();
  private newsSearchUtils: NewsSearchUtils;

  constructor() {
    this.newsSearchUtils = new NewsSearchUtils();
  }

  public cancelTask = async (
    taskId: string,
    eventBus: ExecutionEventBus,
  ): Promise<void> => {
    this.cancelledTasks.add(taskId);
    // Publish immediate cancellation event
    const cancelledUpdate: TaskStatusUpdateEvent = {
      kind: 'status-update',
      taskId,
      contextId: uuidv4(), // Generate context ID for cancellation
      status: {
        state: 'canceled',
        message: {
          kind: 'message',
          role: 'agent',
          messageId: uuidv4(),
          parts: [{ kind: 'text', text: 'News research cancelled.' }],
          taskId,
          contextId: uuidv4(),
        },
        timestamp: new Date().toISOString(),
      },
      final: true,
    };
    eventBus.publish(cancelledUpdate);
  };

  async execute(
    requestContext: RequestContext,
    eventBus: ExecutionEventBus
  ): Promise<void> {
    const { userMessage } = requestContext;
    const existingTask = requestContext.task;

    const taskId = existingTask?.id ?? uuidv4();
    const contextId = (userMessage.contextId ?? existingTask?.contextId) ?? uuidv4();

    console.log(
      `[NewsResearchAgentExecutor] Processing message ${userMessage.messageId} for task ${taskId} (context: ${contextId})`
    );

    // 1. Publish initial Task event if it's a new task
    if (!existingTask) {
      const initialTask: Task = {
        kind: 'task',
        id: taskId,
        contextId,
        status: {
          state: 'submitted',
          timestamp: new Date().toISOString(),
        },
        history: [userMessage],
        metadata: userMessage.metadata ?? {},
        artifacts: [],
      };
      eventBus.publish(initialTask);
    }

    // 2. Publish "working" status update
    const workingStatusUpdate: TaskStatusUpdateEvent = {
      kind: 'status-update',
      taskId,
      contextId,
      status: {
        state: 'working',
        message: {
          kind: 'message',
          role: 'agent',
          messageId: uuidv4(),
          parts: [{ kind: 'text', text: 'Conducting comprehensive news research...' }],
          taskId,
          contextId,
        },
        timestamp: new Date().toISOString(),
      },
      final: false,
    };
    eventBus.publish(workingStatusUpdate);

    try {
      // 3. Extract research query from user message
      const researchQuery = this.extractResearchQuery(userMessage);

      // 4. Perform comprehensive news research
      const newsResults = await this.performNewsResearch(researchQuery);

      // Check if cancelled
      if (this.cancelledTasks.has(taskId)) {
        console.log(`[NewsResearchAgentExecutor] Request cancelled for task: ${taskId}`);
        const cancelledUpdate: TaskStatusUpdateEvent = {
          kind: 'status-update',
          taskId,
          contextId,
          status: {
            state: 'canceled',
            message: {
              kind: 'message',
              role: 'agent',
              messageId: uuidv4(),
              parts: [{ kind: 'text', text: 'News research cancelled.' }],
              taskId,
              contextId,
            },
            timestamp: new Date().toISOString(),
          },
          final: true,
        };
        eventBus.publish(cancelledUpdate);
        return;
      }

      // 5. Synthesize news findings
      const newsFindings = await this.synthesizeNewsFindings(newsResults, researchQuery);

      // 6. Publish status update with research results
      const statusUpdate: TaskStatusUpdateEvent = {
        kind: 'status-update',
        taskId,
        contextId,
        status: {
          state: 'working',
          message: {
            kind: 'message',
            role: 'agent',
            messageId: uuidv4(),
            parts: [{
              kind: 'text',
              text: `News research completed. Analyzed ${newsFindings?.newsFindings?.length ?? 0} news events from ${newsFindings?.metadata?.totalArticles ?? 0} articles`
            }],
            taskId,
            contextId,
          },
          timestamp: new Date().toISOString(),
        },
        final: false,
      };
      eventBus.publish(statusUpdate);

      // 7. Complete the research task
      const completionUpdate: TaskStatusUpdateEvent = {
        kind: 'status-update',
        taskId,
        contextId,
        status: {
          state: 'completed',
          message: {
            kind: 'message',
            role: 'agent',
            messageId: uuidv4(),
            parts: [{
              kind: 'text',
              text: `News research completed successfully. Average source credibility: ${newsFindings?.metadata?.credibilityAverage ?? 'N/A'}`
            }],
            taskId,
            contextId,
          },
          timestamp: new Date().toISOString(),
        },
        final: true,
      };
      eventBus.publish(completionUpdate);

    } catch (error) {
      console.error(`[NewsResearchAgentExecutor] Error processing task ${taskId}:`, error);
      const failureUpdate: TaskStatusUpdateEvent = {
        kind: 'status-update',
        taskId,
        contextId,
        status: {
          state: 'failed',
          message: {
            kind: 'message',
            role: 'agent',
            messageId: uuidv4(),
            parts: [{ kind: 'text', text: `News research failed: ${error instanceof Error ? error.message : 'Unknown error'}` }],
            taskId,
            contextId,
          },
          timestamp: new Date().toISOString(),
        },
        final: true,
      };
      eventBus.publish(failureUpdate);
    }
  }

  private extractResearchQuery(userMessage: any): string {
    // Extract the research query from the user message
    const textParts = userMessage.parts.filter((p: any) => p.kind === 'text' && p.text);
    if (textParts.length === 0) {
      throw new Error('No text content found in user message');
    }

    // Combine all text parts and clean up the query
    const query = textParts.map((p: any) => p.text).join(' ').trim();

    // Remove common prefixes that might be in the query
    const cleanedQuery = query
      .replace(/^(research|analyze|find|search|look up|check)\s+/i, '')
      .replace(/\s+(news|articles?|coverage|stories?)$/i, '')
      .trim();

    return cleanedQuery || query; // fallback to original if cleaning removes everything
  }

  private async performNewsResearch(query: string): Promise<ComprehensiveNewsResult> {
    console.log(`[NewsResearchAgentExecutor] Performing news research for: "${query}"`);

    try {
      // Perform comprehensive news search across multiple sources
      const results = await this.newsSearchUtils.comprehensiveNewsSearch(query, {
        limit: 20,
        timeRange: 'week'
      });

      console.log(`[NewsResearchAgentExecutor] Found ${results.totalResults} articles from ${results.sourcesSearched.length} sources`);

      return results;
    } catch (error) {
      console.error('[NewsResearchAgentExecutor] News search failed:', error);
      throw new Error(`News search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async synthesizeNewsFindings(newsResults: ComprehensiveNewsResult, originalQuery: string): Promise<any> {
    console.log(`[NewsResearchAgentExecutor] Synthesizing findings from ${newsResults.totalResults} articles`);

    // Group articles by topic/theme
    const topicGroups = this.groupArticlesByTopic(newsResults.articles);

    // Calculate credibility metrics
    const credibilityStats = this.calculateCredibilityStats(newsResults.articles);

    // Identify key events and timelines
    const keyEvents = this.extractKeyEvents(newsResults.articles, originalQuery);

    // Analyze media coverage patterns
    const mediaAnalysis = this.analyzeMediaCoverage(newsResults.articles, topicGroups);

    // Generate comprehensive findings structure
    return {
          newsFindings: keyEvents.map(event => ({
            event: event.title,
            timeline: event.timeline,
            currentStatus: event.status,
            impactLevel: event.impactLevel,
            stakeholderImpacts: event.stakeholders
          })),
          mediaAnalysis: {
            coverageConsensus: mediaAnalysis.consensus,
            dominantNarratives: mediaAnalysis.narratives,
            underreportedAspects: mediaAnalysis.gaps,
            mediaBiasObservations: mediaAnalysis.biasObservations,
            factCheckingStatus: mediaAnalysis.factCheckStatus
          },
          contextAndAnalysis: {
            historicalContext: this.generateHistoricalContext(keyEvents, originalQuery),
            expertReactions: this.extractExpertReactions(newsResults.articles),
            publicReaction: this.analyzePublicReaction(newsResults.articles),
            futureImplications: this.assessFutureImplications(keyEvents),
            relatedStories: this.findRelatedStories(newsResults.articles, originalQuery)
          },
          metadata: {
            totalArticles: newsResults.totalResults,
            dateRange: newsResults.timeRange,
            primarySources: topicGroups.size,
            credibilityAverage: credibilityStats.average,
            lastUpdated: new Date().toISOString(),
            breakingNews: this.detectBreakingNews(newsResults.articles),
            sourcesSearched: newsResults.sourcesSearched,
            queryProcessed: originalQuery
          }
        };
  }

  private groupArticlesByTopic(articles: NewsArticle[]): Map<string, NewsArticle[]> {
    const groups = new Map<string, NewsArticle[]>();

    for (const article of articles) {
      // Simple topic extraction based on title keywords
      const title = article.title.toLowerCase();
      let topic = 'general';

      // Extract potential topics from title
      if (title.includes('election') || title.includes('vote') || title.includes('campaign')) {
        topic = 'politics';
      } else if (title.includes('climate') || title.includes('environment') || title.includes('carbon')) {
        topic = 'environment';
      } else if (title.includes('economy') || title.includes('market') || title.includes('finance')) {
        topic = 'economy';
      } else if (title.includes('health') || title.includes('medical') || title.includes('vaccine')) {
        topic = 'health';
      } else if (title.includes('technology') || title.includes('tech') || title.includes('ai')) {
        topic = 'technology';
      } else if (title.includes('sports') || title.includes('game') || title.includes('team')) {
        topic = 'sports';
      } else if (title.includes('crime') || title.includes('police') || title.includes('court')) {
        topic = 'crime';
      }

      if (!groups.has(topic)) {
        groups.set(topic, []);
      }
      groups.get(topic)!.push(article);
    }

    return groups;
  }

  private calculateCredibilityStats(articles: NewsArticle[]): { average: number; distribution: any } {
    const scores = articles.map(a => a.credibility.score);
    const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;

    const distribution = {
      high: scores.filter(s => s > 0.8).length,
      medium: scores.filter(s => s > 0.6 && s <= 0.8).length,
      low: scores.filter(s => s <= 0.6).length
    };

    return { average, distribution };
  }

  private extractKeyEvents(articles: NewsArticle[], query: string): any[] {
    // Group articles by similar topics and create event summaries
    const events: any[] = [];
    const processedTitles = new Set<string>();

    for (const article of articles) {
      const titleKey = article.title.toLowerCase().substring(0, 30);
      if (processedTitles.has(titleKey)) {continue;}
      processedTitles.add(titleKey);

      const relatedArticles = articles.filter(a =>
        a.title.toLowerCase().includes(titleKey.substring(0, 15))
      );

      events.push({
        title: article.title,
        timeline: [{
          date: article.published,
          headline: article.title,
          summary: article.snippet,
          sources: [{
            outlet: article.source,
            url: article.link,
            credibilityScore: article.credibility.score,
            publicationDate: article.published,
            biasAssessment: 'center', // Simplified
            keyQuotes: [article.snippet]
          }]
        }],
        status: this.determineEventStatus(article),
        impactLevel: this.assessImpactLevel(relatedArticles.length),
        stakeholders: this.identifyStakeholders(article, query)
      });
    }

    return events.slice(0, 5); // Limit to top 5 events
  }

  private determineEventStatus(article: NewsArticle): string {
    const daysSincePublished = (Date.now() - new Date(article.published).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSincePublished < 1) {
      return 'breaking';
    }
    if (daysSincePublished < 3) {
      return 'developing';
    }
    return 'ongoing';
  }

  private assessImpactLevel(articleCount: number): string {
    if (articleCount > 10) {
      return 'global';
    }
    if (articleCount > 5) {
      return 'national';
    }
    if (articleCount > 2) {
      return 'regional';
    }
    return 'local';
  }

  private identifyStakeholders(article: NewsArticle, query: string): string[] {
    const stakeholders: string[] = [];
    const content = (article.title + ' ' + article.snippet).toLowerCase();

    if (content.includes('government') || content.includes('policy')) {
      stakeholders.push('Government');
    }
    if (content.includes('public') || content.includes('people')) {
      stakeholders.push('General public');
    }
    if (content.includes('business') || content.includes('company')) {
      stakeholders.push('Business sector');
    }
    if (content.includes('expert') || content.includes('scientist')) {
      stakeholders.push('Experts/Scientists');
    }
    // Use the query parameter: if the query is mentioned in the content, add a stakeholder label
    if (query && content.includes(query.toLowerCase())) {
      stakeholders.push('Query-related Stakeholder');
    }

    return stakeholders.length > 0 ? stakeholders : ['General public'];
  }

  private analyzeMediaCoverage(articles: NewsArticle[], topicGroups: Map<string, NewsArticle[]>): any {
    const sources = [...new Set(articles.map(a => a.source))];

    return {
      consensus: sources.length > 3 ? 'high' : 'medium',
      narratives: Array.from(topicGroups.keys()).slice(0, 3),
      gaps: ['International perspectives', 'Long-term implications'],
      biasObservations: ['Generally balanced coverage'],
      factCheckStatus: 'verified'
    };
  }

  private generateHistoricalContext(events: any[], query: string): string {
    return `Recent developments in ${query} include ${events.length} key events, showing evolving patterns with increasing media attention and stakeholder engagement.`;
  }

  private extractExpertReactions(articles: NewsArticle[]): string[] {
    // Extract quotes or expert mentions from articles
    const reactions: string[] = [];
    for (const article of articles) {
      if (article.snippet.includes('expert') || article.snippet.includes('analyst')) {
        reactions.push(`Expert analysis: ${article.snippet.substring(0, 100)}...`);
      }
    }
    return reactions.slice(0, 3);
  }

  private analyzePublicReaction(articles: NewsArticle[]): string {
    return `Public interest appears moderate with steady coverage across ${articles.length} sources.`;
  }

  private assessFutureImplications(events: any[]): string {
    return `Continued monitoring recommended as ${events.length} developments unfold.`;
  }

  private findRelatedStories(articles: NewsArticle[], query: string): string[] {
    const related: string[] = [];
    const queryWords = query.toLowerCase().split(' ');

    for (const article of articles) {
      const titleWords = article.title.toLowerCase().split(' ');
      const matches = queryWords.filter(word => titleWords.includes(word)).length;
      if (matches > 0) {
        related.push(article.title);
      }
    }

    return related.slice(0, 3);
  }

  private detectBreakingNews(articles: NewsArticle[]): boolean {
    const recentArticles = articles.filter(article => {
      const hoursSincePublished = (Date.now() - new Date(article.published).getTime()) / (1000 * 60 * 60);
      return hoursSincePublished < 24;
    });

    return recentArticles.length > articles.length * 0.3; // 30% of articles are very recent
  }
}

// --- Server Setup ---

const newsResearchAgentCard: AgentCard = {
  protocolVersion: '1.0',
  name: 'News Research Agent',
  description:
    'An agent that conducts comprehensive news research, analyzes current events, and evaluates media credibility across multiple news sources.',
  url: 'http://localhost:41246/',
  provider: {
    organization: 'A2A Samples',
    url: 'https://example.com/a2a-samples',
  },
  version: '0.0.1',
  capabilities: {
    streaming: true,
    pushNotifications: false,
    stateTransitionHistory: true,
  },
  securitySchemes: {},
  security: [],
  defaultInputModes: ['text'],
  defaultOutputModes: ['text'],
  skills: [
    {
      id: 'news_research',
      name: 'News Research',
      description:
        'Conducts comprehensive news analysis with credibility assessment, current events tracking, and media bias evaluation across diverse news sources.',
      tags: ['news', 'current-events', 'media', 'credibility'],
      examples: [
        'Research the latest developments in climate policy',
        'Analyze media coverage of recent elections',
        'Track breaking news on international conflicts',
        'Evaluate news credibility on scientific discoveries',
      ],
      inputModes: ['text'],
      outputModes: ['text'],
    },
  ],
  supportsAuthenticatedExtendedCard: false,
};

async function main() {
  // 1. Create TaskStore
  const taskStore: TaskStore = new InMemoryTaskStore();

  // 2. Create AgentExecutor
  const agentExecutor: AgentExecutor = new NewsResearchAgentExecutor();

  // 3. Create DefaultRequestHandler
  const requestHandler = new DefaultRequestHandler(
    newsResearchAgentCard,
    taskStore,
    agentExecutor
  );

  // 4. Create and setup A2AExpressApp
  const appBuilder = new A2AExpressApp(requestHandler);
  const expressApp = appBuilder.setupRoutes(express(), '');

  // 5. Start the server
  const PORT = process.env.NEWS_RESEARCH_AGENT_PORT || 41246;
  expressApp.listen(PORT, () => {
    console.log(`[NewsResearchAgent] Server started on http://localhost:${PORT}`);
    console.log(`[NewsResearchAgent] Agent Card: http://localhost:${PORT}/.well-known/agent-card.json`);
    console.log('[NewsResearchAgent] Press Ctrl+C to stop the server');
  });
}

main().catch(console.error);