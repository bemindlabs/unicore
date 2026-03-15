/**
 * CommsAgent — Email drafting & social media management.
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
export class CommsAgent extends SpecialistAgentBase {
  readonly agentType: AgentType = "comms";
  readonly config: SpecialistAgentConfig = {
    displayName: "Comms Agent",
    description:
      "Manages all communications — email drafting, inbox triage, and social media scheduling.",
    version: "0.1.0",
  };

  protected buildSystemPrompt(context: AgentContext): string {
    const businessName =
      (context.businessContext?.["businessName"] as string | undefined) ??
      "the business";
    const tone =
      (context.businessContext?.["commsDefaultTone"] as string | undefined) ??
      "professional and friendly";
    return `You are the Comms Agent for ${businessName}. Tone: ${tone}. Available tools: ${this.getToolDefinitions()
      .map((t) => t.name)
      .join(", ")}.`;
  }

  getToolDefinitions(): ToolDefinition[] {
    return [
      {
        name: "draft_email",
        description:
          "Compose an email draft given a recipient, subject, and intent.",
        parameters: {
          type: "object",
          properties: {
            to: { type: "string", description: "Recipient email address" },
            subject: { type: "string", description: "Email subject line" },
            intent: { type: "string", description: "Purpose of the email" },
            tone: {
              type: "string",
              description: "Desired tone",
              enum: ["formal", "casual", "empathetic", "assertive"],
            },
            context: {
              type: "string",
              description: "Additional background information",
            },
          },
          required: ["to", "subject", "intent"],
        },
      },
      {
        name: "send_email",
        description: "Send a previously drafted email.",
        parameters: {
          type: "object",
          properties: {
            draftId: { type: "string", description: "ID of the draft to send" },
            provider: {
              type: "string",
              description: "Email provider",
              enum: ["smtp", "sendgrid", "ses"],
            },
          },
          required: ["draftId"],
        },
      },
      {
        name: "list_inbox",
        description: "Fetch unread emails from the configured inbox.",
        parameters: {
          type: "object",
          properties: {
            limit: { type: "number", description: "Maximum number of emails" },
            filterLabel: { type: "string", description: "Filter by label" },
            onlyUnread: {
              type: "boolean",
              description: "Return only unread emails",
            },
          },
          required: [],
        },
      },
      {
        name: "reply_email",
        description: "Generate a contextual reply to an existing email thread.",
        parameters: {
          type: "object",
          properties: {
            threadId: { type: "string", description: "ID of the email thread" },
            intent: { type: "string", description: "Intent of the reply" },
            sendImmediately: {
              type: "boolean",
              description: "Send without review",
            },
          },
          required: ["threadId", "intent"],
        },
      },
      {
        name: "schedule_post",
        description:
          "Schedule a social media post across one or more channels.",
        parameters: {
          type: "object",
          properties: {
            content: { type: "string", description: "The post body text" },
            channels: {
              type: "array",
              description: "Target channels",
              items: {
                type: "string",
                description: "Social channel name",
                enum: ["facebook", "instagram", "twitter", "linkedin", "line"],
              },
            },
            scheduledAt: {
              type: "string",
              description: "ISO-8601 datetime when the post should go live",
            },
            mediaUrls: {
              type: "array",
              description: "Optional media URLs",
              items: { type: "string", description: "Media URL" },
            },
          },
          required: ["content", "channels"],
        },
      },
      {
        name: "fetch_social_feed",
        description:
          "Retrieve recent mentions and engagement metrics from social accounts.",
        parameters: {
          type: "object",
          properties: {
            channel: {
              type: "string",
              description: "Social channel",
              enum: ["facebook", "instagram", "twitter", "linkedin", "line"],
            },
            since: {
              type: "string",
              description: "Return items after this datetime",
            },
            limit: { type: "number", description: "Max items to return" },
          },
          required: ["channel"],
        },
      },
      {
        name: "moderate_comment",
        description: "Classify and action a social media comment.",
        parameters: {
          type: "object",
          properties: {
            commentId: { type: "string", description: "Comment identifier" },
            channel: {
              type: "string",
              description: "Social channel",
              enum: ["facebook", "instagram", "twitter"],
            },
            action: {
              type: "string",
              description: "Moderation action",
              enum: ["reply", "hide", "delete", "flag"],
            },
            replyText: { type: "string", description: "Reply body" },
          },
          required: ["commentId", "channel", "action"],
        },
      },
    ];
  }

  protected async executeTool(
    call: ToolCall,
    _context: AgentContext,
  ): Promise<ToolResult> {
    this.logger.debug(`[comms] executing tool: ${call.toolName}`);
    switch (call.toolName) {
      case "draft_email": {
        const res = await fetch(`${process.env.AI_ENGINE_URL}/llm/invoke`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: `Draft an email to ${call.arguments["to"]} with subject "${call.arguments["subject"]}". Intent: ${call.arguments["intent"]}. Tone: ${call.arguments["tone"] ?? "professional"}. Context: ${call.arguments["context"] ?? ""}`,
          }),
        });
        const data = await res.json();
        return {
          toolName: call.toolName,
          result: { draftId: this.newId(), status: "drafted", content: data },
        };
      }
      case "send_email": {
        const res = await fetch(
          `${process.env.ERP_SERVICE_URL}/comms/email/send`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(call.arguments),
          },
        );
        const data = await res.json();
        return { toolName: call.toolName, result: data };
      }
      case "list_inbox": {
        const params = new URLSearchParams();
        if (call.arguments["limit"] != null)
          params.set("limit", String(call.arguments["limit"]));
        if (call.arguments["filterLabel"] != null)
          params.set("filterLabel", String(call.arguments["filterLabel"]));
        if (call.arguments["onlyUnread"] != null)
          params.set("onlyUnread", String(call.arguments["onlyUnread"]));
        const res = await fetch(
          `${process.env.ERP_SERVICE_URL}/comms/email/inbox?${params.toString()}`,
        );
        const data = await res.json();
        return { toolName: call.toolName, result: data };
      }
      case "reply_email": {
        const draftRes = await fetch(
          `${process.env.AI_ENGINE_URL}/llm/invoke`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: `Draft a reply for email thread ${call.arguments["threadId"]}. Intent: ${call.arguments["intent"]}.`,
            }),
          },
        );
        const draft = await draftRes.json();
        const res = await fetch(
          `${process.env.ERP_SERVICE_URL}/comms/email/reply`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...call.arguments, draftContent: draft }),
          },
        );
        const data = await res.json();
        return { toolName: call.toolName, result: data };
      }
      case "schedule_post": {
        const res = await fetch(
          `${process.env.ERP_SERVICE_URL}/comms/social/schedule`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(call.arguments),
          },
        );
        const data = await res.json();
        return { toolName: call.toolName, result: data };
      }
      case "fetch_social_feed": {
        const params = new URLSearchParams();
        params.set("channel", String(call.arguments["channel"]));
        if (call.arguments["since"] != null)
          params.set("since", String(call.arguments["since"]));
        if (call.arguments["limit"] != null)
          params.set("limit", String(call.arguments["limit"]));
        const res = await fetch(
          `${process.env.ERP_SERVICE_URL}/comms/social/feed?${params.toString()}`,
        );
        const data = await res.json();
        return { toolName: call.toolName, result: data };
      }
      case "moderate_comment": {
        const res = await fetch(`${process.env.AI_ENGINE_URL}/llm/invoke`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: `Moderate a social media comment. Comment ID: ${call.arguments["commentId"]}. Channel: ${call.arguments["channel"]}. Action: ${call.arguments["action"]}. Reply text: ${call.arguments["replyText"] ?? ""}`,
          }),
        });
        const data = await res.json();
        return {
          toolName: call.toolName,
          result: {
            commentId: call.arguments["commentId"],
            action: call.arguments["action"],
            status: "completed",
            moderationResult: data,
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
