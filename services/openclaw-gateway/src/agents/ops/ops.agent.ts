/**
 * OpsAgent — Task management & scheduling.
 *
 * Capabilities:
 *  - create_task         : Add a new task with assignee, priority, and due date
 *  - update_task         : Modify task fields (status, priority, due date, notes)
 *  - list_tasks          : Query tasks by assignee, status, or due date
 *  - schedule_event      : Book a calendar event for the team
 *  - check_availability  : Query free/busy slots for a team member
 *  - set_reminder        : Configure an automated reminder for a task or event
 *  - generate_standup    : Produce a daily standup summary from open tasks
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
export class OpsAgent extends SpecialistAgentBase {
  readonly agentType: AgentType = 'ops';

  readonly config: SpecialistAgentConfig = {
    displayName: 'Ops Agent',
    description:
      'Manages tasks, scheduling, and daily operations so the team stays productive.',
    version: '0.1.0',
  };

  // -------------------------------------------------------------------------
  // System prompt
  // -------------------------------------------------------------------------

  protected buildSystemPrompt(context: AgentContext): string {
    const businessName =
      (context.businessContext?.['businessName'] as string | undefined) ??
      'the business';
    const timezone =
      (context.businessContext?.['timezone'] as string | undefined) ??
      'UTC';

    return `You are the Ops Agent for ${businessName}.
Your role is to keep daily operations running smoothly:
  - Create, update, and prioritise tasks for the team
  - Schedule meetings, events, and recurring check-ins
  - Check team availability before booking time
  - Send reminders for upcoming deadlines
  - Generate daily standup briefings from open task lists

All timestamps should be expressed in ${timezone} unless the user specifies otherwise.
Proactively flag overdue tasks and blocked items.
When autonomy is set to "full_auto", you may create and update tasks without confirmation.

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
        name: 'create_task',
        description: 'Create a new task in the team task board.',
        parameters: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'Short task title',
            },
            description: {
              type: 'string',
              description: 'Detailed task description',
            },
            assigneeId: {
              type: 'string',
              description: 'User ID of the person responsible',
            },
            priority: {
              type: 'string',
              description: 'Task priority level',
              enum: ['critical', 'high', 'medium', 'low'],
            },
            dueDate: {
              type: 'string',
              description: 'Due date (ISO-8601)',
            },
            labels: {
              type: 'array',
              description: 'Optional tags or labels',
              items: { type: 'string', description: 'Label string' },
            },
            parentTaskId: {
              type: 'string',
              description: 'ID of the parent task (for subtasks)',
            },
          },
          required: ['title'],
        },
      },
      {
        name: 'update_task',
        description: 'Update one or more fields on an existing task.',
        parameters: {
          type: 'object',
          properties: {
            taskId: {
              type: 'string',
              description: 'Task identifier to update',
            },
            status: {
              type: 'string',
              description: 'New status',
              enum: ['todo', 'in_progress', 'blocked', 'done', 'cancelled'],
            },
            priority: {
              type: 'string',
              description: 'New priority',
              enum: ['critical', 'high', 'medium', 'low'],
            },
            dueDate: {
              type: 'string',
              description: 'Updated due date (ISO-8601)',
            },
            assigneeId: {
              type: 'string',
              description: 'Reassign to this user ID',
            },
            notes: {
              type: 'string',
              description: 'Progress notes to append',
            },
          },
          required: ['taskId'],
        },
      },
      {
        name: 'list_tasks',
        description: 'Query the task board with filters.',
        parameters: {
          type: 'object',
          properties: {
            assigneeId: {
              type: 'string',
              description: 'Filter by assignee user ID',
            },
            status: {
              type: 'string',
              description: 'Filter by status',
              enum: ['todo', 'in_progress', 'blocked', 'done', 'cancelled'],
            },
            priority: {
              type: 'string',
              description: 'Filter by priority',
              enum: ['critical', 'high', 'medium', 'low'],
            },
            dueBeforeDate: {
              type: 'string',
              description: 'Return tasks due before this date (ISO-8601)',
            },
            includeOverdue: {
              type: 'boolean',
              description: 'When true, include overdue tasks regardless of status',
            },
            limit: {
              type: 'number',
              description: 'Max tasks to return',
            },
          },
          required: [],
        },
      },
      {
        name: 'schedule_event',
        description: 'Create a calendar event for one or more team members.',
        parameters: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'Event title',
            },
            startAt: {
              type: 'string',
              description: 'Event start datetime (ISO-8601)',
            },
            endAt: {
              type: 'string',
              description: 'Event end datetime (ISO-8601)',
            },
            attendeeIds: {
              type: 'array',
              description: 'List of attendee user IDs',
              items: { type: 'string', description: 'User ID' },
            },
            location: {
              type: 'string',
              description: 'Physical location or video call URL',
            },
            description: {
              type: 'string',
              description: 'Event agenda or notes',
            },
            recurrence: {
              type: 'string',
              description: 'Recurrence rule (RRULE format or shorthand)',
            },
          },
          required: ['title', 'startAt', 'endAt'],
        },
      },
      {
        name: 'check_availability',
        description: 'Return free/busy time slots for a team member within a range.',
        parameters: {
          type: 'object',
          properties: {
            userId: {
              type: 'string',
              description: 'User ID to check',
            },
            from: {
              type: 'string',
              description: 'Start of window (ISO-8601)',
            },
            to: {
              type: 'string',
              description: 'End of window (ISO-8601)',
            },
            slotDurationMinutes: {
              type: 'number',
              description: 'Minimum slot length to surface (default: 30)',
            },
          },
          required: ['userId', 'from', 'to'],
        },
      },
      {
        name: 'set_reminder',
        description: 'Set an automated reminder for a task or event.',
        parameters: {
          type: 'object',
          properties: {
            targetType: {
              type: 'string',
              description: 'What to remind about',
              enum: ['task', 'event'],
            },
            targetId: {
              type: 'string',
              description: 'Task or event identifier',
            },
            remindAt: {
              type: 'string',
              description: 'When to send the reminder (ISO-8601)',
            },
            channel: {
              type: 'string',
              description: 'Delivery channel',
              enum: ['in_app', 'email', 'slack', 'line'],
            },
            message: {
              type: 'string',
              description: 'Custom reminder message',
            },
          },
          required: ['targetType', 'targetId', 'remindAt', 'channel'],
        },
      },
      {
        name: 'generate_standup',
        description: 'Generate a daily standup summary from open and recently completed tasks.',
        parameters: {
          type: 'object',
          properties: {
            teamIds: {
              type: 'array',
              description: 'Limit standup to these user IDs (default: all team members)',
              items: { type: 'string', description: 'User ID' },
            },
            includeBlockers: {
              type: 'boolean',
              description: 'Include a blockers section (default: true)',
            },
            format: {
              type: 'string',
              description: 'Output format',
              enum: ['text', 'markdown', 'slack_block_kit'],
            },
          },
          required: [],
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
    this.logger.debug(`[ops] executing tool: ${call.toolName}`);

    switch (call.toolName) {
      case 'create_task':
        return {
          toolName: call.toolName,
          result: {
            taskId: this.newId(),
            title: call.arguments['title'],
            status: 'todo',
            createdAt: new Date().toISOString(),
          },
        };

      case 'update_task':
        return {
          toolName: call.toolName,
          result: {
            taskId: call.arguments['taskId'],
            updated: true,
            updatedAt: new Date().toISOString(),
          },
        };

      case 'list_tasks':
        return {
          toolName: call.toolName,
          result: { tasks: [], total: 0 },
        };

      case 'schedule_event':
        return {
          toolName: call.toolName,
          result: {
            eventId: this.newId(),
            title: call.arguments['title'],
            status: 'scheduled',
            createdAt: new Date().toISOString(),
          },
        };

      case 'check_availability':
        return {
          toolName: call.toolName,
          result: {
            userId: call.arguments['userId'],
            freeSlots: [],
          },
        };

      case 'set_reminder':
        return {
          toolName: call.toolName,
          result: {
            reminderId: this.newId(),
            status: 'scheduled',
            remindAt: call.arguments['remindAt'],
          },
        };

      case 'generate_standup':
        return {
          toolName: call.toolName,
          result: {
            generatedAt: new Date().toISOString(),
            sections: { completed: [], inProgress: [], blockers: [], upcoming: [] },
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
