/**
 * GrowthAgent — Funnel analysis & ad campaign management.
 *
 * Capabilities:
 *  - analyse_funnel       : Map conversion rates across pipeline stages
 *  - identify_drop_offs   : Pinpoint highest-friction funnel stages
 *  - get_ad_performance   : Fetch campaign metrics from ad platforms
 *  - adjust_ad_budget     : Reallocate spend across campaigns
 *  - create_campaign      : Scaffold a new ad campaign
 *  - generate_utm         : Produce UTM-tagged links for tracking
 *  - segment_audience     : Define and export audience segments
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
export class GrowthAgent extends SpecialistAgentBase {
  readonly agentType: AgentType = 'growth';

  readonly config: SpecialistAgentConfig = {
    displayName: 'Growth Agent',
    description:
      'Analyses conversion funnels and manages ad campaigns to drive sustainable revenue growth.',
    version: '0.1.0',
  };

  // -------------------------------------------------------------------------
  // System prompt
  // -------------------------------------------------------------------------

  protected buildSystemPrompt(context: AgentContext): string {
    const businessName =
      (context.businessContext?.['businessName'] as string | undefined) ??
      'the business';
    const currency =
      (context.businessContext?.['currency'] as string | undefined) ?? 'USD';

    return `You are the Growth Agent for ${businessName}.
Your role is to drive revenue growth through data-driven analysis:
  - Map customer journey stages and identify where leads drop off
  - Monitor ad performance across Google Ads, Meta Ads, and other connected platforms
  - Recommend and execute budget reallocations to maximise ROAS
  - Generate properly tagged links for campaign tracking
  - Define audience segments for targeted outreach

Always frame recommendations with supporting metrics (CTR, CPC, ROAS, CVR).
Currency is ${currency}. Flag campaigns with ROAS below 2x for urgent review.
Never spend money on ads without explicit user approval.

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
        name: 'analyse_funnel',
        description: 'Calculate conversion rates and volume for each stage of the sales/marketing funnel.',
        parameters: {
          type: 'object',
          properties: {
            funnelId: {
              type: 'string',
              description: 'ERP funnel/pipeline identifier',
            },
            period: {
              type: 'string',
              description: 'Analysis period',
              enum: ['last_7d', 'last_30d', 'last_90d', 'custom'],
            },
            from: {
              type: 'string',
              description: 'Custom period start (ISO-8601)',
            },
            to: {
              type: 'string',
              description: 'Custom period end (ISO-8601)',
            },
          },
          required: ['funnelId'],
        },
      },
      {
        name: 'identify_drop_offs',
        description: 'Surface the top N funnel stages with the highest lead loss rates.',
        parameters: {
          type: 'object',
          properties: {
            funnelId: {
              type: 'string',
              description: 'ERP funnel/pipeline identifier',
            },
            topN: {
              type: 'number',
              description: 'Number of worst stages to return (default: 3)',
            },
          },
          required: ['funnelId'],
        },
      },
      {
        name: 'get_ad_performance',
        description: 'Retrieve campaign metrics from a connected ad platform.',
        parameters: {
          type: 'object',
          properties: {
            platform: {
              type: 'string',
              description: 'Ad platform to query',
              enum: ['google_ads', 'meta_ads', 'tiktok_ads', 'line_ads'],
            },
            campaignId: {
              type: 'string',
              description: 'Platform-specific campaign identifier (omit for all campaigns)',
            },
            metrics: {
              type: 'array',
              description: 'Metrics to include in the response',
              items: {
                type: 'string',
                description: 'Metric name',
                enum: ['impressions', 'clicks', 'ctr', 'cpc', 'spend', 'conversions', 'roas'],
              },
            },
            period: {
              type: 'string',
              description: 'Date range',
              enum: ['today', 'yesterday', 'last_7d', 'last_30d'],
            },
          },
          required: ['platform'],
        },
      },
      {
        name: 'adjust_ad_budget',
        description: 'Reallocate daily/lifetime budget for one or more campaigns.',
        parameters: {
          type: 'object',
          properties: {
            platform: {
              type: 'string',
              description: 'Ad platform',
              enum: ['google_ads', 'meta_ads', 'tiktok_ads', 'line_ads'],
            },
            adjustments: {
              type: 'array',
              description: 'Budget adjustments per campaign',
              items: {
                type: 'object',
                description: 'Campaign budget change',
                properties: {
                  campaignId: { type: 'string', description: 'Campaign ID' },
                  newDailyBudget: { type: 'number', description: 'New daily budget amount' },
                },
              },
            },
            reason: {
              type: 'string',
              description: 'Human-readable reason for the adjustment',
            },
          },
          required: ['platform', 'adjustments'],
        },
      },
      {
        name: 'create_campaign',
        description: 'Scaffold a new ad campaign on the specified platform.',
        parameters: {
          type: 'object',
          properties: {
            platform: {
              type: 'string',
              description: 'Ad platform',
              enum: ['google_ads', 'meta_ads'],
            },
            name: {
              type: 'string',
              description: 'Campaign name',
            },
            objective: {
              type: 'string',
              description: 'Campaign objective',
              enum: ['awareness', 'traffic', 'leads', 'sales', 'app_installs'],
            },
            dailyBudget: {
              type: 'number',
              description: 'Daily budget in the business currency',
            },
            targetAudience: {
              type: 'string',
              description: 'Audience segment ID or description',
            },
          },
          required: ['platform', 'name', 'objective', 'dailyBudget'],
        },
      },
      {
        name: 'generate_utm',
        description: 'Generate a UTM-tagged URL for campaign tracking.',
        parameters: {
          type: 'object',
          properties: {
            baseUrl: {
              type: 'string',
              description: 'Destination URL without UTM parameters',
            },
            source: {
              type: 'string',
              description: 'utm_source (e.g. google, facebook, newsletter)',
            },
            medium: {
              type: 'string',
              description: 'utm_medium (e.g. cpc, social, email)',
            },
            campaign: {
              type: 'string',
              description: 'utm_campaign slug',
            },
            content: {
              type: 'string',
              description: 'utm_content for A/B differentiation',
            },
          },
          required: ['baseUrl', 'source', 'medium', 'campaign'],
        },
      },
      {
        name: 'segment_audience',
        description: 'Define an audience segment based on ERP/CRM criteria and export for ad targeting.',
        parameters: {
          type: 'object',
          properties: {
            segmentName: {
              type: 'string',
              description: 'Human-readable segment label',
            },
            criteria: {
              type: 'object',
              description: 'Filter criteria for the segment',
              properties: {
                minLifetimeValue: { type: 'number', description: 'Minimum LTV' },
                purchasedInLastDays: { type: 'number', description: 'Purchased within N days' },
                tags: { type: 'array', items: { type: 'string', description: 'Tag name' }, description: 'Contact tags' },
              },
            },
            exportTo: {
              type: 'string',
              description: 'Ad platform to sync the audience to',
              enum: ['google_ads', 'meta_ads', 'none'],
            },
          },
          required: ['segmentName', 'criteria'],
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
    this.logger.debug(`[growth] executing tool: ${call.toolName}`);

    switch (call.toolName) {
      case 'analyse_funnel':
        return {
          toolName: call.toolName,
          result: { stages: [], overallConversionRate: 0, period: call.arguments['period'] },
        };

      case 'identify_drop_offs':
        return {
          toolName: call.toolName,
          result: { topDropOffs: [] },
        };

      case 'get_ad_performance':
        return {
          toolName: call.toolName,
          result: {
            platform: call.arguments['platform'],
            campaigns: [],
            period: call.arguments['period'],
          },
        };

      case 'adjust_ad_budget':
        return {
          toolName: call.toolName,
          result: {
            platform: call.arguments['platform'],
            applied: [],
            status: 'pending_approval',
          },
        };

      case 'create_campaign':
        return {
          toolName: call.toolName,
          result: {
            campaignId: this.newId(),
            platform: call.arguments['platform'],
            status: 'draft',
            createdAt: new Date().toISOString(),
          },
        };

      case 'generate_utm':
        return {
          toolName: call.toolName,
          result: {
            utmUrl:
              `${call.arguments['baseUrl']}?utm_source=${call.arguments['source']}` +
              `&utm_medium=${call.arguments['medium']}&utm_campaign=${call.arguments['campaign']}`,
          },
        };

      case 'segment_audience':
        return {
          toolName: call.toolName,
          result: {
            segmentId: this.newId(),
            segmentName: call.arguments['segmentName'],
            estimatedSize: 0,
            status: 'building',
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
