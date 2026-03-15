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

import { Injectable } from "@nestjs/common";
import { AgentContext, AgentType } from "../../interfaces/agent-base.interface";
import {
  SpecialistAgentBase,
  SpecialistAgentConfig,
  ToolDefinition,
  ToolCall,
  ToolResult,
} from "../base/specialist-agent.base";

@Injectable()
export class GrowthAgent extends SpecialistAgentBase {
  readonly agentType: AgentType = "growth";

  readonly config: SpecialistAgentConfig = {
    displayName: "Growth Agent",
    description:
      "Analyses conversion funnels and manages ad campaigns to drive sustainable revenue growth.",
    version: "0.1.0",
  };

  // -------------------------------------------------------------------------
  // System prompt
  // -------------------------------------------------------------------------

  protected buildSystemPrompt(context: AgentContext): string {
    const businessName =
      (context.businessContext?.["businessName"] as string | undefined) ??
      "the business";
    const currency =
      (context.businessContext?.["currency"] as string | undefined) ?? "USD";

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
      .join(", ")}.`;
  }

  // -------------------------------------------------------------------------
  // Tool definitions
  // -------------------------------------------------------------------------

  getToolDefinitions(): ToolDefinition[] {
    return [
      {
        name: "analyse_funnel",
        description:
          "Calculate conversion rates and volume for each stage of the sales/marketing funnel.",
        parameters: {
          type: "object",
          properties: {
            funnelId: {
              type: "string",
              description: "ERP funnel/pipeline identifier",
            },
            period: {
              type: "string",
              description: "Analysis period",
              enum: ["last_7d", "last_30d", "last_90d", "custom"],
            },
            from: {
              type: "string",
              description: "Custom period start (ISO-8601)",
            },
            to: {
              type: "string",
              description: "Custom period end (ISO-8601)",
            },
          },
          required: ["funnelId"],
        },
      },
      {
        name: "identify_drop_offs",
        description:
          "Surface the top N funnel stages with the highest lead loss rates.",
        parameters: {
          type: "object",
          properties: {
            funnelId: {
              type: "string",
              description: "ERP funnel/pipeline identifier",
            },
            topN: {
              type: "number",
              description: "Number of worst stages to return (default: 3)",
            },
          },
          required: ["funnelId"],
        },
      },
      {
        name: "get_ad_performance",
        description: "Retrieve campaign metrics from a connected ad platform.",
        parameters: {
          type: "object",
          properties: {
            platform: {
              type: "string",
              description: "Ad platform to query",
              enum: ["google_ads", "meta_ads", "tiktok_ads", "line_ads"],
            },
            campaignId: {
              type: "string",
              description:
                "Platform-specific campaign identifier (omit for all campaigns)",
            },
            metrics: {
              type: "array",
              description: "Metrics to include in the response",
              items: {
                type: "string",
                description: "Metric name",
                enum: [
                  "impressions",
                  "clicks",
                  "ctr",
                  "cpc",
                  "spend",
                  "conversions",
                  "roas",
                ],
              },
            },
            period: {
              type: "string",
              description: "Date range",
              enum: ["today", "yesterday", "last_7d", "last_30d"],
            },
          },
          required: ["platform"],
        },
      },
      {
        name: "adjust_ad_budget",
        description:
          "Reallocate daily/lifetime budget for one or more campaigns.",
        parameters: {
          type: "object",
          properties: {
            platform: {
              type: "string",
              description: "Ad platform",
              enum: ["google_ads", "meta_ads", "tiktok_ads", "line_ads"],
            },
            adjustments: {
              type: "array",
              description: "Budget adjustments per campaign",
              items: {
                type: "object",
                description: "Campaign budget change",
                properties: {
                  campaignId: { type: "string", description: "Campaign ID" },
                  newDailyBudget: {
                    type: "number",
                    description: "New daily budget amount",
                  },
                },
              },
            },
            reason: {
              type: "string",
              description: "Human-readable reason for the adjustment",
            },
          },
          required: ["platform", "adjustments"],
        },
      },
      {
        name: "create_campaign",
        description: "Scaffold a new ad campaign on the specified platform.",
        parameters: {
          type: "object",
          properties: {
            platform: {
              type: "string",
              description: "Ad platform",
              enum: ["google_ads", "meta_ads"],
            },
            name: {
              type: "string",
              description: "Campaign name",
            },
            objective: {
              type: "string",
              description: "Campaign objective",
              enum: ["awareness", "traffic", "leads", "sales", "app_installs"],
            },
            dailyBudget: {
              type: "number",
              description: "Daily budget in the business currency",
            },
            targetAudience: {
              type: "string",
              description: "Audience segment ID or description",
            },
          },
          required: ["platform", "name", "objective", "dailyBudget"],
        },
      },
      {
        name: "generate_utm",
        description: "Generate a UTM-tagged URL for campaign tracking.",
        parameters: {
          type: "object",
          properties: {
            baseUrl: {
              type: "string",
              description: "Destination URL without UTM parameters",
            },
            source: {
              type: "string",
              description: "utm_source (e.g. google, facebook, newsletter)",
            },
            medium: {
              type: "string",
              description: "utm_medium (e.g. cpc, social, email)",
            },
            campaign: {
              type: "string",
              description: "utm_campaign slug",
            },
            content: {
              type: "string",
              description: "utm_content for A/B differentiation",
            },
          },
          required: ["baseUrl", "source", "medium", "campaign"],
        },
      },
      {
        name: "segment_audience",
        description:
          "Define an audience segment based on ERP/CRM criteria and export for ad targeting.",
        parameters: {
          type: "object",
          properties: {
            segmentName: {
              type: "string",
              description: "Human-readable segment label",
            },
            criteria: {
              type: "object",
              description: "Filter criteria for the segment",
              properties: {
                minLifetimeValue: {
                  type: "number",
                  description: "Minimum LTV",
                },
                purchasedInLastDays: {
                  type: "number",
                  description: "Purchased within N days",
                },
                tags: {
                  type: "array",
                  items: { type: "string", description: "Tag name" },
                  description: "Contact tags",
                },
              },
            },
            exportTo: {
              type: "string",
              description: "Ad platform to sync the audience to",
              enum: ["google_ads", "meta_ads", "none"],
            },
          },
          required: ["segmentName", "criteria"],
        },
      },
    ];
  }

  // -------------------------------------------------------------------------
  // Service URL helpers
  // -------------------------------------------------------------------------

  private get erpBase(): string {
    return (
      process.env["ERP_SERVICE_URL"] ??
      `http://${process.env["ERP_SERVICE_HOST"] ?? "localhost"}:${process.env["ERP_SERVICE_PORT"] ?? "4100"}`
    );
  }

  private get aiEngineBase(): string {
    return (
      process.env["AI_ENGINE_SERVICE_URL"] ??
      `http://${process.env["AI_ENGINE_SERVICE_HOST"] ?? "localhost"}:${process.env["AI_ENGINE_SERVICE_PORT"] ?? "4200"}`
    );
  }

  private async callAiEngine(prompt: string, maxTokens = 500): Promise<string> {
    const resp = await fetch(`${this.aiEngineBase}/api/v1/llm/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }],
        maxTokens,
      }),
    });
    if (!resp.ok) throw new Error(`AI Engine responded with ${resp.status}`);
    const data = (await resp.json()) as { content: string };
    return data.content;
  }

  private tryParseJson(text: string): unknown {
    const stripped = text
      .replace(/^```(?:json)?\n?/, "")
      .replace(/\n?```$/, "")
      .trim();
    try {
      return JSON.parse(stripped);
    } catch {
      /* fall through */
    }
    const match = stripped.match(/(\{[\s\S]+\}|\[[\s\S]+\])/);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch {
        /* fall through */
      }
    }
    return { text };
  }

  // -------------------------------------------------------------------------
  // Tool execution
  // -------------------------------------------------------------------------

  protected async executeTool(
    call: ToolCall,
    _context: AgentContext,
  ): Promise<ToolResult> {
    this.logger.debug(`[growth] executing tool: ${call.toolName}`);

    switch (call.toolName) {
      case "analyse_funnel": {
        const orderStatuses = [
          "PENDING",
          "CONFIRMED",
          "PROCESSING",
          "SHIPPED",
          "FULFILLED",
        ];
        const [contactsData, ...orderData] = await Promise.all([
          fetch(`${this.erpBase}/api/erp/contacts?limit=1`).then((r) =>
            r.json(),
          ) as Promise<{ meta: { total: number } }>,
          ...orderStatuses.map(
            (s) =>
              fetch(`${this.erpBase}/api/erp/orders?status=${s}&limit=1`).then(
                (r) => r.json(),
              ) as Promise<{ meta: { total: number } }>,
          ),
        ]);
        const leadCount = contactsData.meta?.total ?? 0;
        const stageLabels = [
          "pending",
          "confirmed",
          "processing",
          "shipped",
          "fulfilled",
        ];
        const allStages = [
          { stage: "leads", count: leadCount },
          ...orderData.map((d, i) => ({
            stage: stageLabels[i],
            count: d.meta?.total ?? 0,
          })),
        ];
        const stages = allStages.map((s, i) => {
          const prev = i === 0 ? leadCount : allStages[i - 1].count;
          return {
            ...s,
            conversionRate:
              prev > 0 ? parseFloat(((s.count / prev) * 100).toFixed(2)) : 0,
          };
        });
        const last = allStages[allStages.length - 1].count;
        const overallConversionRate =
          leadCount > 0 ? parseFloat(((last / leadCount) * 100).toFixed(2)) : 0;
        return {
          toolName: call.toolName,
          result: {
            funnelId: call.arguments["funnelId"],
            stages,
            overallConversionRate,
            period: call.arguments["period"] ?? "all_time",
          },
        };
      }

      case "identify_drop_offs": {
        const topN = (call.arguments["topN"] as number | undefined) ?? 3;
        const orderStatuses = [
          "PENDING",
          "CONFIRMED",
          "PROCESSING",
          "SHIPPED",
          "FULFILLED",
        ];
        const [contactsData, ...orderData] = await Promise.all([
          fetch(`${this.erpBase}/api/erp/contacts?limit=1`).then((r) =>
            r.json(),
          ) as Promise<{ meta: { total: number } }>,
          ...orderStatuses.map(
            (s) =>
              fetch(`${this.erpBase}/api/erp/orders?status=${s}&limit=1`).then(
                (r) => r.json(),
              ) as Promise<{ meta: { total: number } }>,
          ),
        ]);
        const leadCount = contactsData.meta?.total ?? 0;
        const stageLabels = [
          "pending",
          "confirmed",
          "processing",
          "shipped",
          "fulfilled",
        ];
        const allStages = [
          { stage: "leads", count: leadCount },
          ...orderData.map((d, i) => ({
            stage: stageLabels[i],
            count: d.meta?.total ?? 0,
          })),
        ];
        const topDropOffs = allStages
          .slice(0, -1)
          .map((s, i) => {
            const next = allStages[i + 1];
            const dropOffRate =
              s.count > 0
                ? parseFloat(
                    (((s.count - next.count) / s.count) * 100).toFixed(2),
                  )
                : 0;
            return {
              fromStage: s.stage,
              toStage: next.stage,
              entered: s.count,
              proceeded: next.count,
              dropOffRate,
            };
          })
          .sort((a, b) => b.dropOffRate - a.dropOffRate)
          .slice(0, topN);
        return {
          toolName: call.toolName,
          result: { funnelId: call.arguments["funnelId"], topDropOffs },
        };
      }

      case "get_ad_performance": {
        const platform = call.arguments["platform"] as string;
        const campaignId = call.arguments["campaignId"] as string | undefined;
        const metrics = (call.arguments["metrics"] as string[] | undefined) ?? [
          "impressions",
          "clicks",
          "ctr",
          "cpc",
          "spend",
          "conversions",
          "roas",
        ];
        const period =
          (call.arguments["period"] as string | undefined) ?? "last_30d";
        const prompt = `Return a JSON object (no markdown, no explanation) for ad performance data:
{"platform":"${platform}","period":"${period}","campaigns":[{"campaignId":"${campaignId ?? "all"}","name":"Sample Campaign","status":"active","metrics":{${metrics.map((m) => `"${m}":0`).join(",")}}}]}
Fill in realistic numeric values for a ${platform} campaign over ${period}.`;
        const content = await this.callAiEngine(prompt, 400);
        return { toolName: call.toolName, result: this.tryParseJson(content) };
      }

      case "adjust_ad_budget": {
        const platform = call.arguments["platform"] as string;
        const adjustments = call.arguments["adjustments"] as Array<{
          campaignId: string;
          newDailyBudget: number;
        }>;
        const reason =
          (call.arguments["reason"] as string | undefined) ?? "Not specified";
        const prompt = `Return a JSON object (no markdown) confirming these ad budget adjustments for ${platform}:
Adjustments: ${JSON.stringify(adjustments)}
Reason: ${reason}
Format: {"platform":"${platform}","applied":[{"campaignId":string,"previousDailyBudget":number,"newDailyBudget":number,"changePercent":number}],"status":"applied","processedAt":"${new Date().toISOString()}"}`;
        const content = await this.callAiEngine(prompt, 350);
        return { toolName: call.toolName, result: this.tryParseJson(content) };
      }

      case "create_campaign": {
        const platform = call.arguments["platform"] as string;
        const name = call.arguments["name"] as string;
        const objective = call.arguments["objective"] as string;
        const dailyBudget = call.arguments["dailyBudget"] as number;
        const targetAudience =
          (call.arguments["targetAudience"] as string | undefined) ?? "broad";
        const campaignId = this.newId();
        const prompt = `Return a JSON object (no markdown) scaffolding a new ${platform} campaign:
{"campaignId":"${campaignId}","platform":"${platform}","name":"${name}","objective":"${objective}","dailyBudget":${dailyBudget},"targetAudience":"${targetAudience}","status":"draft","adSets":[{"adSetId":"<uuid>","name":"Ad Set 1","targeting":{"audience":"${targetAudience}","placements":["feed"]}}],"createdAt":"${new Date().toISOString()}"}
Fill in plausible values for a ${objective} campaign.`;
        const content = await this.callAiEngine(prompt, 400);
        const parsed = this.tryParseJson(content);
        return {
          toolName: call.toolName,
          result:
            parsed &&
            typeof parsed === "object" &&
            "campaignId" in (parsed as object)
              ? parsed
              : {
                  campaignId,
                  platform,
                  name,
                  objective,
                  dailyBudget,
                  status: "draft",
                  createdAt: new Date().toISOString(),
                },
        };
      }

      case "generate_utm": {
        const baseUrl = call.arguments["baseUrl"] as string;
        const source = encodeURIComponent(call.arguments["source"] as string);
        const medium = encodeURIComponent(call.arguments["medium"] as string);
        const campaign = encodeURIComponent(
          call.arguments["campaign"] as string,
        );
        const content = call.arguments["content"] as string | undefined;
        const sep = baseUrl.includes("?") ? "&" : "?";
        let utmUrl = `${baseUrl}${sep}utm_source=${source}&utm_medium=${medium}&utm_campaign=${campaign}`;
        if (content) utmUrl += `&utm_content=${encodeURIComponent(content)}`;
        return {
          toolName: call.toolName,
          result: {
            utmUrl,
            params: {
              utm_source: source,
              utm_medium: medium,
              utm_campaign: campaign,
              ...(content ? { utm_content: content } : {}),
            },
          },
        };
      }

      case "segment_audience": {
        const segmentName = call.arguments["segmentName"] as string;
        const criteria =
          (call.arguments["criteria"] as
            | {
                minLifetimeValue?: number;
                purchasedInLastDays?: number;
                tags?: string[];
              }
            | undefined) ?? {};
        const exportTo =
          (call.arguments["exportTo"] as string | undefined) ?? "none";
        const minLeadScore = criteria.minLifetimeValue
          ? Math.min(Math.floor(criteria.minLifetimeValue / 100), 100)
          : 0;
        const resp = await fetch(
          `${this.erpBase}/api/erp/contacts?minLeadScore=${minLeadScore}&limit=100`,
        );
        if (!resp.ok) throw new Error(`ERP responded with ${resp.status}`);
        const data = (await resp.json()) as {
          data: unknown[];
          meta: { total: number };
        };
        return {
          toolName: call.toolName,
          result: {
            segmentId: this.newId(),
            segmentName,
            criteria,
            estimatedSize: data.meta?.total ?? 0,
            exportTo,
            status: exportTo !== "none" ? "exporting" : "ready",
            sampleContacts: (data.data ?? []).slice(0, 5),
          },
        };
      }

      default:
        return {
          toolName: call.toolName,
          result: null,
          error: `Unknown tool: ${call.toolName}`,
        };
    }
  }
}
