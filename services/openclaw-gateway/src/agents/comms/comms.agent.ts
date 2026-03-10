/**
 * CommsAgent — Email drafting & social media management.
 *
 * Capabilities:
 *  - draft_email        : Compose outbound emails with tone/intent control
 *  - send_email         : Dispatch a drafted email via configured provider
 *  - list_inbox         : Fetch unread messages from connected email accounts
 *  - reply_email        : Generate and queue a contextual email reply
 *  - schedule_post      : Schedule a social media post across channels
 *  - fetch_social_feed  : Retrieve recent mentions and engagement metrics
 *  - moderate_comment   : Classify and action a comment (reply/hide/delete)
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
export class CommsAgent extends SpecialistAgentBase {
  readonly agentType: AgentType = 'comms';

  readonly config: SpecialistAgentConfig = {
    displayName: 'Comms Agent',
    description:
      'Manages all communications — email drafting, inbox triage, and social media scheduling.',
    version: '0.1.0',
  };

  // -------------------------------------------------------------------------
  // System prompt
  // -------------------------------------------------------------------------

  protected buildSystemPrompt(context: AgentContext): string {
    const businessName =
      (context.businessContext?.['businessName'] as string | undefined) ??
      'the business';
    const tone =
      (context.businessContext?.['commsDefaultTone'] as string | undefined) ??
      'professional and friendly';

    return `You are the Comms Agent for ${businessName}.
Your role is to handle all inbound and outbound communications, including:
  - Drafting and sending emails on behalf of the business
  - Managing social media posts and community engagement
  - Triaging the inbox and surfacing urgent messages
  - Maintaining a consistent brand voice that is ${tone}

Always confirm before sending irreversible actions (e.g. publishing a post, sending an email) unless
the autonomy level is set to "full_auto".

Available tools: ${this.getToolDefinitions()
      .map((t) => t.name)
      .join(', ')}.

Conversation history is provided for context. The user may refer to previous messages.`;
  }

  // -------------------------------------------------------------------------
  // Tool definitions
  // -------------------------------------------------------------------------

  getToolDefinitions(): ToolDefinition[] {
    return [
      {
        name: 'draft_email',
        description:
          'Compose an email draft given a recipient, subject, and intent. Returns a draft object for review.',
        parameters: {
          type: 'object',
          properties: {
            to: {
              type: 'string',
              description: 'Recipient email address',
            },
            subject: {
              type: 'string',
              description: 'Email subject line',
            },
            intent: {
              type: 'string',
              description: 'Purpose of the email (e.g. follow-up, proposal, support reply)',
            },
            tone: {
              type: 'string',
              description: 'Desired tone: formal | casual | empathetic | assertive',
              enum: ['formal', 'casual', 'empathetic', 'assertive'],
            },
            context: {
              type: 'string',
              description: 'Additional background information to include',
            },
          },
          required: ['to', 'subject', 'intent'],
        },
      },
      {
        name: 'send_email',
        description: 'Send a previously drafted email. Requires explicit user approval in non-auto mode.',
        parameters: {
          type: 'object',
          properties: {
            draftId: {
              type: 'string',
              description: 'ID of the draft to send',
            },
            provider: {
              type: 'string',
              description: 'Email provider to use: smtp | sendgrid | ses',
              enum: ['smtp', 'sendgrid', 'ses'],
            },
          },
          required: ['draftId'],
        },
      },
      {
        name: 'list_inbox',
        description: 'Fetch unread emails from the configured inbox with optional filtering.',
        parameters: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Maximum number of emails to return (default: 20)',
            },
            filterLabel: {
              type: 'string',
              description: 'Only return emails with this label/folder',
            },
            onlyUnread: {
              type: 'boolean',
              description: 'When true, return only unread emails',
            },
          },
          required: [],
        },
      },
      {
        name: 'reply_email',
        description: 'Generate a contextual reply to an existing email thread.',
        parameters: {
          type: 'object',
          properties: {
            threadId: {
              type: 'string',
              description: 'ID of the email thread to reply to',
            },
            intent: {
              type: 'string',
              description: 'Intent of the reply (e.g. acknowledge, reject, request info)',
            },
            sendImmediately: {
              type: 'boolean',
              description: 'If true, send without further review',
            },
          },
          required: ['threadId', 'intent'],
        },
      },
      {
        name: 'schedule_post',
        description: 'Schedule a social media post across one or more channels.',
        parameters: {
          type: 'object',
          properties: {
            content: {
              type: 'string',
              description: 'The post body text (max 280 chars for Twitter/X)',
            },
            channels: {
              type: 'array',
              description: 'Target channels: facebook | instagram | twitter | linkedin | line',
              items: {
                type: 'string',
                description: 'Social channel name',
                enum: ['facebook', 'instagram', 'twitter', 'linkedin', 'line'],
              },
            },
            scheduledAt: {
              type: 'string',
              description: 'ISO-8601 datetime when the post should go live',
            },
            mediaUrls: {
              type: 'array',
              description: 'Optional list of image/video URLs to attach',
              items: { type: 'string', description: 'Media URL' },
            },
          },
          required: ['content', 'channels'],
        },
      },
      {
        name: 'fetch_social_feed',
        description: 'Retrieve recent mentions, comments, and engagement metrics from connected social accounts.',
        parameters: {
          type: 'object',
          properties: {
            channel: {
              type: 'string',
              description: 'Social channel to query',
              enum: ['facebook', 'instagram', 'twitter', 'linkedin', 'line'],
            },
            since: {
              type: 'string',
              description: 'ISO-8601 datetime — return items after this point',
            },
            limit: {
              type: 'number',
              description: 'Max items to return',
            },
          },
          required: ['channel'],
        },
      },
      {
        name: 'moderate_comment',
        description: 'Classify and action a social media comment (reply, hide, or delete).',
        parameters: {
          type: 'object',
          properties: {
            commentId: {
              type: 'string',
              description: 'Platform-specific comment identifier',
            },
            channel: {
              type: 'string',
              description: 'Social channel the comment is on',
              enum: ['facebook', 'instagram', 'twitter'],
            },
            action: {
              type: 'string',
              description: 'Moderation action to take',
              enum: ['reply', 'hide', 'delete', 'flag'],
            },
            replyText: {
              type: 'string',
              description: 'Reply body (required when action=reply)',
            },
          },
          required: ['commentId', 'channel', 'action'],
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
    this.logger.debug(`[comms] executing tool: ${call.toolName}`);

    switch (call.toolName) {
      case 'draft_email':
        return {
          toolName: call.toolName,
          result: {
            draftId: this.newId(),
            status: 'drafted',
            preview: `Draft email to ${call.arguments['to']} re: "${call.arguments['subject']}"`,
          },
        };

      case 'send_email':
        return {
          toolName: call.toolName,
          result: {
            messageId: this.newId(),
            status: 'queued',
            sentAt: new Date().toISOString(),
          },
        };

      case 'list_inbox':
        return {
          toolName: call.toolName,
          result: { emails: [], total: 0, unread: 0 },
        };

      case 'reply_email':
        return {
          toolName: call.toolName,
          result: {
            draftId: this.newId(),
            threadId: call.arguments['threadId'],
            status: 'draft_created',
          },
        };

      case 'schedule_post':
        return {
          toolName: call.toolName,
          result: {
            postId: this.newId(),
            status: 'scheduled',
            scheduledAt: call.arguments['scheduledAt'] ?? 'immediate',
            channels: call.arguments['channels'],
          },
        };

      case 'fetch_social_feed':
        return {
          toolName: call.toolName,
          result: { items: [], channel: call.arguments['channel'], fetched: 0 },
        };

      case 'moderate_comment':
        return {
          toolName: call.toolName,
          result: {
            commentId: call.arguments['commentId'],
            action: call.arguments['action'],
            status: 'completed',
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
