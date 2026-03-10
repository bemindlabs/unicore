/**
 * ResearchAgent — Market intelligence & competitor analysis.
 *
 * Capabilities:
 *  - search_web              : Execute a web search and summarise results
 *  - analyse_competitor      : Pull public data on a competitor (pricing, features, reviews)
 *  - monitor_keywords        : Track keyword mentions across channels
 *  - summarise_document      : Extract key insights from a URL or uploaded document
 *  - generate_market_brief   : Compile a structured market intelligence report
 *  - track_trends            : Identify trending topics in a niche
 *  - benchmark_pricing       : Compare product/service pricing against market data
 */

import { Injectable } from '@nestjs/common';
import { AgentContext, AgentType } from '../../interfaces/agent-base.interface';
import {
  SpecialistAgentBase,
  SpecialistAgentConfig,
  ToolDefinition,
  ToolCall,
  ToolResult,
} from '../base/specialist-agent.base';

@Injectable()
export class ResearchAgent extends SpecialistAgentBase {
  readonly agentType: AgentType = 'research';

  readonly config: SpecialistAgentConfig = {
    displayName: 'Research Agent',
    description:
      'Gathers market intelligence, tracks competitors, and surfaces actionable insights.',
    version: '0.1.0',
  };

  // -------------------------------------------------------------------------
  // System prompt
  // -------------------------------------------------------------------------

  protected buildSystemPrompt(context: AgentContext): string {
    const businessName =
      (context.businessContext?.['businessName'] as string | undefined) ??
      'the business';
    const industry =
      (context.businessContext?.['industry'] as string | undefined) ??
      'your industry';

    return `You are the Research Agent for ${businessName}, operating in ${industry}.
Your role is to surface timely, accurate, and actionable market intelligence:
  - Search the web and summarise findings with citations
  - Profile competitors: pricing, features, sentiment, recent news
  - Monitor mentions of target keywords across the web and social media
  - Summarise documents, research papers, and web pages
  - Compile structured market briefs with executive summaries
  - Identify emerging trends that may affect the business
  - Benchmark pricing strategies against market rates

Always cite your sources. Distinguish clearly between facts and inferences.
Present findings in a concise, executive-friendly format.

Available tools: ${this.getToolDefinitions()
      .map((t) => t.name)
      .join(', ')}.`;
  }

  // -------------------------------------------------------------------------
  // Tool definitions
  // -------------------------------------------------------------------------

  getToolDefinitions(): ToolDefinition[] {
    return [
      {
        name: 'search_web',
        description: 'Execute a web search query and return summarised results with source URLs.',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query string',
            },
            numResults: {
              type: 'number',
              description: 'Number of results to retrieve (default: 10)',
            },
            language: {
              type: 'string',
              description: 'Preferred result language (ISO 639-1 code, e.g. en, th)',
            },
            dateRange: {
              type: 'string',
              description: 'Restrict results to a date range',
              enum: ['last_day', 'last_week', 'last_month', 'last_year', 'any'],
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'analyse_competitor',
        description: 'Gather public data on a competitor: pricing, product features, reviews, and recent news.',
        parameters: {
          type: 'object',
          properties: {
            competitorName: {
              type: 'string',
              description: 'Name or domain of the competitor',
            },
            aspects: {
              type: 'array',
              description: 'Which aspects to research',
              items: {
                type: 'string',
                description: 'Aspect name',
                enum: ['pricing', 'features', 'reviews', 'news', 'social', 'seo'],
              },
            },
          },
          required: ['competitorName'],
        },
      },
      {
        name: 'monitor_keywords',
        description: 'Set up or query a keyword monitor to track brand/topic mentions.',
        parameters: {
          type: 'object',
          properties: {
            keywords: {
              type: 'array',
              description: 'Keywords or phrases to track',
              items: { type: 'string', description: 'Keyword string' },
            },
            channels: {
              type: 'array',
              description: 'Channels to monitor',
              items: {
                type: 'string',
                description: 'Channel name',
                enum: ['web', 'twitter', 'reddit', 'news', 'facebook'],
              },
            },
            action: {
              type: 'string',
              description: 'Whether to create a new monitor or query existing results',
              enum: ['create', 'query'],
            },
            monitorId: {
              type: 'string',
              description: 'Existing monitor ID (required when action=query)',
            },
          },
          required: ['keywords', 'action'],
        },
      },
      {
        name: 'summarise_document',
        description: 'Fetch and extract key insights from a URL or uploaded document.',
        parameters: {
          type: 'object',
          properties: {
            source: {
              type: 'string',
              description: 'URL or document ID to summarise',
            },
            focusAreas: {
              type: 'array',
              description: 'Topics to focus on within the document',
              items: { type: 'string', description: 'Topic area' },
            },
            maxLength: {
              type: 'number',
              description: 'Maximum word count for the summary',
            },
          },
          required: ['source'],
        },
      },
      {
        name: 'generate_market_brief',
        description: 'Compile a structured market intelligence report on a given topic or market segment.',
        parameters: {
          type: 'object',
          properties: {
            topic: {
              type: 'string',
              description: 'Market segment or topic to research',
            },
            sections: {
              type: 'array',
              description: 'Sections to include in the brief',
              items: {
                type: 'string',
                description: 'Section name',
                enum: ['overview', 'trends', 'competitors', 'opportunities', 'threats', 'recommendations'],
              },
            },
            depth: {
              type: 'string',
              description: 'Research depth level',
              enum: ['quick', 'standard', 'deep'],
            },
          },
          required: ['topic'],
        },
      },
      {
        name: 'track_trends',
        description: 'Identify trending topics and search queries in a given niche or industry.',
        parameters: {
          type: 'object',
          properties: {
            niche: {
              type: 'string',
              description: 'Industry or niche to analyse',
            },
            geo: {
              type: 'string',
              description: 'Geographic market (ISO 3166-1 alpha-2 code, e.g. US, TH)',
            },
            period: {
              type: 'string',
              description: 'Trend window',
              enum: ['last_24h', 'last_7d', 'last_30d'],
            },
          },
          required: ['niche'],
        },
      },
      {
        name: 'benchmark_pricing',
        description: 'Compare a product or service price point against market data.',
        parameters: {
          type: 'object',
          properties: {
            productDescription: {
              type: 'string',
              description: 'Description of the product or service to benchmark',
            },
            currentPrice: {
              type: 'number',
              description: 'Current price point to compare',
            },
            competitors: {
              type: 'array',
              description: 'Specific competitor names to include (optional)',
              items: { type: 'string', description: 'Competitor name' },
            },
            market: {
              type: 'string',
              description: 'Geographic market to benchmark against',
            },
          },
          required: ['productDescription', 'currentPrice'],
        },
      },
    ];
  }

  // -------------------------------------------------------------------------
  // Tool execution stubs
  // -------------------------------------------------------------------------

  protected async executeTool(
    call: ToolCall,
    _context: AgentContext,
  ): Promise<ToolResult> {
    this.logger.debug(`[research] executing tool: ${call.toolName}`);

    switch (call.toolName) {
      case 'search_web':
        return {
          toolName: call.toolName,
          result: { query: call.arguments['query'], results: [], totalFound: 0 },
        };

      case 'analyse_competitor':
        return {
          toolName: call.toolName,
          result: {
            competitor: call.arguments['competitorName'],
            profile: {},
            fetchedAt: new Date().toISOString(),
          },
        };

      case 'monitor_keywords':
        if (call.arguments['action'] === 'create') {
          return {
            toolName: call.toolName,
            result: {
              monitorId: this.newId(),
              keywords: call.arguments['keywords'],
              status: 'active',
            },
          };
        }
        return {
          toolName: call.toolName,
          result: {
            monitorId: call.arguments['monitorId'],
            mentions: [],
            fetchedAt: new Date().toISOString(),
          },
        };

      case 'summarise_document':
        return {
          toolName: call.toolName,
          result: {
            source: call.arguments['source'],
            summary: '',
            keyPoints: [],
            wordCount: 0,
          },
        };

      case 'generate_market_brief':
        return {
          toolName: call.toolName,
          result: {
            briefId: this.newId(),
            topic: call.arguments['topic'],
            sections: {},
            generatedAt: new Date().toISOString(),
          },
        };

      case 'track_trends':
        return {
          toolName: call.toolName,
          result: {
            niche: call.arguments['niche'],
            trends: [],
            fetchedAt: new Date().toISOString(),
          },
        };

      case 'benchmark_pricing':
        return {
          toolName: call.toolName,
          result: {
            productDescription: call.arguments['productDescription'],
            currentPrice: call.arguments['currentPrice'],
            marketRange: { min: 0, median: 0, max: 0 },
            competitors: [],
          },
        };

      default:
        return {
          toolName: call.toolName,
          result: null,
          error: `Unknown tool: ${call.toolName}`,
        };
    }
  }
}
