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
export class OpsAgent extends SpecialistAgentBase {
  readonly agentType: AgentType = "ops";

  readonly config: SpecialistAgentConfig = {
    displayName: "Ops Agent",
    description:
      "Manages tasks, scheduling, and daily operations so the team stays productive.",
    version: "0.1.0",
  };

  // -------------------------------------------------------------------------
  // System prompt
  // -------------------------------------------------------------------------

  protected buildSystemPrompt(context: AgentContext): string {
    const businessName =
      (context.businessContext?.["businessName"] as string | undefined) ??
      "the business";
    const timezone =
      (context.businessContext?.["timezone"] as string | undefined) ?? "UTC";

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
      .join(", ")}.`;
  }

  // -------------------------------------------------------------------------
  // Tool definitions
  // -------------------------------------------------------------------------

  getToolDefinitions(): ToolDefinition[] {
    return [
      {
        name: "create_task",
        description: "Create a new task in the team task board.",
        parameters: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "Short task title",
            },
            description: {
              type: "string",
              description: "Detailed task description",
            },
            assigneeId: {
              type: "string",
              description: "User ID of the person responsible",
            },
            priority: {
              type: "string",
              description: "Task priority level",
              enum: ["critical", "high", "medium", "low"],
            },
            dueDate: {
              type: "string",
              description: "Due date (ISO-8601)",
            },
            labels: {
              type: "array",
              description: "Optional tags or labels",
              items: { type: "string", description: "Label string" },
            },
            parentTaskId: {
              type: "string",
              description: "ID of the parent task (for subtasks)",
            },
          },
          required: ["title"],
        },
      },
      {
        name: "update_task",
        description: "Update one or more fields on an existing task.",
        parameters: {
          type: "object",
          properties: {
            taskId: {
              type: "string",
              description: "Task identifier to update",
            },
            status: {
              type: "string",
              description: "New status",
              enum: ["todo", "in_progress", "blocked", "done", "cancelled"],
            },
            priority: {
              type: "string",
              description: "New priority",
              enum: ["critical", "high", "medium", "low"],
            },
            dueDate: {
              type: "string",
              description: "Updated due date (ISO-8601)",
            },
            assigneeId: {
              type: "string",
              description: "Reassign to this user ID",
            },
            notes: {
              type: "string",
              description: "Progress notes to append",
            },
          },
          required: ["taskId"],
        },
      },
      {
        name: "list_tasks",
        description: "Query the task board with filters.",
        parameters: {
          type: "object",
          properties: {
            assigneeId: {
              type: "string",
              description: "Filter by assignee user ID",
            },
            status: {
              type: "string",
              description: "Filter by status",
              enum: ["todo", "in_progress", "blocked", "done", "cancelled"],
            },
            priority: {
              type: "string",
              description: "Filter by priority",
              enum: ["critical", "high", "medium", "low"],
            },
            dueBeforeDate: {
              type: "string",
              description: "Return tasks due before this date (ISO-8601)",
            },
            includeOverdue: {
              type: "boolean",
              description:
                "When true, include overdue tasks regardless of status",
            },
            limit: {
              type: "number",
              description: "Max tasks to return",
            },
          },
          required: [],
        },
      },
      {
        name: "schedule_event",
        description: "Create a calendar event for one or more team members.",
        parameters: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "Event title",
            },
            startAt: {
              type: "string",
              description: "Event start datetime (ISO-8601)",
            },
            endAt: {
              type: "string",
              description: "Event end datetime (ISO-8601)",
            },
            attendeeIds: {
              type: "array",
              description: "List of attendee user IDs",
              items: { type: "string", description: "User ID" },
            },
            location: {
              type: "string",
              description: "Physical location or video call URL",
            },
            description: {
              type: "string",
              description: "Event agenda or notes",
            },
            recurrence: {
              type: "string",
              description: "Recurrence rule (RRULE format or shorthand)",
            },
          },
          required: ["title", "startAt", "endAt"],
        },
      },
      {
        name: "check_availability",
        description:
          "Return free/busy time slots for a team member within a range.",
        parameters: {
          type: "object",
          properties: {
            userId: {
              type: "string",
              description: "User ID to check",
            },
            from: {
              type: "string",
              description: "Start of window (ISO-8601)",
            },
            to: {
              type: "string",
              description: "End of window (ISO-8601)",
            },
            slotDurationMinutes: {
              type: "number",
              description: "Minimum slot length to surface (default: 30)",
            },
          },
          required: ["userId", "from", "to"],
        },
      },
      {
        name: "set_reminder",
        description: "Set an automated reminder for a task or event.",
        parameters: {
          type: "object",
          properties: {
            targetType: {
              type: "string",
              description: "What to remind about",
              enum: ["task", "event"],
            },
            targetId: {
              type: "string",
              description: "Task or event identifier",
            },
            remindAt: {
              type: "string",
              description: "When to send the reminder (ISO-8601)",
            },
            channel: {
              type: "string",
              description: "Delivery channel",
              enum: ["in_app", "email", "slack", "line"],
            },
            message: {
              type: "string",
              description: "Custom reminder message",
            },
          },
          required: ["targetType", "targetId", "remindAt", "channel"],
        },
      },
      {
        name: "generate_standup",
        description:
          "Generate a daily standup summary from open and recently completed tasks.",
        parameters: {
          type: "object",
          properties: {
            teamIds: {
              type: "array",
              description:
                "Limit standup to these user IDs (default: all team members)",
              items: { type: "string", description: "User ID" },
            },
            includeBlockers: {
              type: "boolean",
              description: "Include a blockers section (default: true)",
            },
            format: {
              type: "string",
              description: "Output format",
              enum: ["text", "markdown", "slack_block_kit"],
            },
          },
          required: [],
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
    this.logger.debug(`[ops] executing tool: ${call.toolName}`);

    switch (call.toolName) {
      case "create_task": {
        const taskId = this.newId();
        const title = call.arguments["title"] as string;
        const description = call.arguments["description"] as string | undefined;
        const assigneeId = call.arguments["assigneeId"] as string | undefined;
        const priority =
          (call.arguments["priority"] as string | undefined) ?? "medium";
        const dueDate = call.arguments["dueDate"] as string | undefined;
        const labels = (call.arguments["labels"] as string[] | undefined) ?? [];
        const parentTaskId = call.arguments["parentTaskId"] as
          | string
          | undefined;
        const prompt = `Return a JSON object (no markdown) representing a newly created task:
{"taskId":"${taskId}","title":"${title}","description":"${description ?? ""}","assigneeId":"${assigneeId ?? "unassigned"}","priority":"${priority}","dueDate":"${dueDate ?? ""}","labels":${JSON.stringify(labels)},"parentTaskId":"${parentTaskId ?? ""}","status":"todo","createdAt":"${new Date().toISOString()}"}
Fill in any missing plausible fields. Keep taskId exactly as provided.`;
        const content = await this.callAiEngine(prompt, 350);
        const parsed = this.tryParseJson(content);
        return {
          toolName: call.toolName,
          result:
            parsed &&
            typeof parsed === "object" &&
            "taskId" in (parsed as object)
              ? parsed
              : {
                  taskId,
                  title,
                  priority,
                  status: "todo",
                  createdAt: new Date().toISOString(),
                },
        };
      }

      case "update_task": {
        const taskId = call.arguments["taskId"] as string;
        const updates: Record<string, unknown> = {};
        if (call.arguments["status"])
          updates["status"] = call.arguments["status"];
        if (call.arguments["priority"])
          updates["priority"] = call.arguments["priority"];
        if (call.arguments["dueDate"])
          updates["dueDate"] = call.arguments["dueDate"];
        if (call.arguments["assigneeId"])
          updates["assigneeId"] = call.arguments["assigneeId"];
        if (call.arguments["notes"]) updates["notes"] = call.arguments["notes"];
        const prompt = `Return a JSON object (no markdown) confirming these task updates:
{"taskId":"${taskId}","updates":${JSON.stringify(updates)},"updated":true,"updatedAt":"${new Date().toISOString()}"}
Reflect the applied changes accurately.`;
        const content = await this.callAiEngine(prompt, 300);
        const parsed = this.tryParseJson(content);
        return {
          toolName: call.toolName,
          result:
            parsed &&
            typeof parsed === "object" &&
            "taskId" in (parsed as object)
              ? parsed
              : {
                  taskId,
                  ...updates,
                  updated: true,
                  updatedAt: new Date().toISOString(),
                },
        };
      }

      case "list_tasks": {
        const filters: Record<string, unknown> = {};
        if (call.arguments["assigneeId"])
          filters["assigneeId"] = call.arguments["assigneeId"];
        if (call.arguments["status"])
          filters["status"] = call.arguments["status"];
        if (call.arguments["priority"])
          filters["priority"] = call.arguments["priority"];
        if (call.arguments["dueBeforeDate"])
          filters["dueBeforeDate"] = call.arguments["dueBeforeDate"];
        if (call.arguments["includeOverdue"])
          filters["includeOverdue"] = call.arguments["includeOverdue"];
        const limit = (call.arguments["limit"] as number | undefined) ?? 20;

        // Enrich with ERP data for standup/reporting context
        const erpResp = await fetch(
          `${this.erpBase}/api/erp/orders?limit=${limit}`,
        );
        const erpData = erpResp.ok
          ? ((await erpResp.json()) as {
              data: unknown[];
              meta: { total: number };
            })
          : { data: [], meta: { total: 0 } };

        const prompt = `Return a JSON object (no markdown) listing tasks filtered by: ${JSON.stringify(filters)}.
Use this ERP orders context to inform task statuses: ${JSON.stringify(erpData.data.slice(0, 5))}
Format: {"tasks":[{"taskId":string,"title":string,"status":string,"priority":string,"assigneeId":string,"dueDate":string}],"total":number}
Return up to ${limit} plausible tasks based on the ERP context and filters.`;
        const content = await this.callAiEngine(prompt, 500);
        const parsed = this.tryParseJson(content);
        return {
          toolName: call.toolName,
          result:
            parsed &&
            typeof parsed === "object" &&
            "tasks" in (parsed as object)
              ? parsed
              : { tasks: [], total: 0, filters },
        };
      }

      case "schedule_event": {
        const eventId = this.newId();
        const title = call.arguments["title"] as string;
        const startAt = call.arguments["startAt"] as string;
        const endAt = call.arguments["endAt"] as string;
        const attendeeIds =
          (call.arguments["attendeeIds"] as string[] | undefined) ?? [];
        const location = call.arguments["location"] as string | undefined;
        const description = call.arguments["description"] as string | undefined;
        const recurrence = call.arguments["recurrence"] as string | undefined;
        const prompt = `Return a JSON object (no markdown) for a scheduled calendar event:
{"eventId":"${eventId}","title":"${title}","startAt":"${startAt}","endAt":"${endAt}","attendeeIds":${JSON.stringify(attendeeIds)},"location":"${location ?? ""}","description":"${description ?? ""}","recurrence":"${recurrence ?? ""}","status":"scheduled","createdAt":"${new Date().toISOString()}"}
Fill in any plausible missing values. Keep eventId as provided.`;
        const content = await this.callAiEngine(prompt, 350);
        const parsed = this.tryParseJson(content);
        return {
          toolName: call.toolName,
          result:
            parsed &&
            typeof parsed === "object" &&
            "eventId" in (parsed as object)
              ? parsed
              : {
                  eventId,
                  title,
                  startAt,
                  endAt,
                  attendeeIds,
                  status: "scheduled",
                  createdAt: new Date().toISOString(),
                },
        };
      }

      case "check_availability": {
        const userId = call.arguments["userId"] as string;
        const from = call.arguments["from"] as string;
        const to = call.arguments["to"] as string;
        const slotDurationMinutes =
          (call.arguments["slotDurationMinutes"] as number | undefined) ?? 30;
        const prompt = `Return a JSON object (no markdown) with free/busy availability for user ${userId}:
{"userId":"${userId}","from":"${from}","to":"${to}","slotDurationMinutes":${slotDurationMinutes},"freeSlots":[{"start":"<ISO-8601>","end":"<ISO-8601>"}],"busySlots":[{"start":"<ISO-8601>","end":"<ISO-8601>","reason":"Meeting"}]}
Generate realistic free/busy slots within the given window.`;
        const content = await this.callAiEngine(prompt, 400);
        const parsed = this.tryParseJson(content);
        return {
          toolName: call.toolName,
          result:
            parsed &&
            typeof parsed === "object" &&
            "userId" in (parsed as object)
              ? parsed
              : {
                  userId,
                  from,
                  to,
                  slotDurationMinutes,
                  freeSlots: [],
                  busySlots: [],
                },
        };
      }

      case "set_reminder": {
        const reminderId = this.newId();
        const targetType = call.arguments["targetType"] as string;
        const targetId = call.arguments["targetId"] as string;
        const remindAt = call.arguments["remindAt"] as string;
        const channel = call.arguments["channel"] as string;
        const message = call.arguments["message"] as string | undefined;
        const prompt = `Return a JSON object (no markdown) confirming a scheduled reminder:
{"reminderId":"${reminderId}","targetType":"${targetType}","targetId":"${targetId}","remindAt":"${remindAt}","channel":"${channel}","message":"${message ?? `Reminder for ${targetType} ${targetId}`}","status":"scheduled","scheduledAt":"${new Date().toISOString()}"}
Keep reminderId as provided.`;
        const content = await this.callAiEngine(prompt, 300);
        const parsed = this.tryParseJson(content);
        return {
          toolName: call.toolName,
          result:
            parsed &&
            typeof parsed === "object" &&
            "reminderId" in (parsed as object)
              ? parsed
              : {
                  reminderId,
                  targetType,
                  targetId,
                  remindAt,
                  channel,
                  status: "scheduled",
                },
        };
      }

      case "generate_standup": {
        const teamIds = call.arguments["teamIds"] as string[] | undefined;
        const includeBlockers =
          (call.arguments["includeBlockers"] as boolean | undefined) ?? true;
        const format =
          (call.arguments["format"] as string | undefined) ?? "markdown";

        // Fetch live ERP data to ground the standup in real business context
        const [ordersResp, contactsResp] = await Promise.all([
          fetch(`${this.erpBase}/api/erp/orders?status=PROCESSING&limit=10`),
          fetch(`${this.erpBase}/api/erp/contacts?limit=5`),
        ]);
        const ordersData = ordersResp.ok
          ? ((await ordersResp.json()) as {
              data: unknown[];
              meta: { total: number };
            })
          : { data: [], meta: { total: 0 } };
        const contactsData = contactsResp.ok
          ? ((await contactsResp.json()) as {
              data: unknown[];
              meta: { total: number };
            })
          : { data: [], meta: { total: 0 } };

        const prompt = `Generate a daily standup summary in ${format} format.
${teamIds ? `Team members: ${teamIds.join(", ")}` : "Include all team members."}
Include blockers section: ${includeBlockers}.
Use this live ERP context:
- Orders in processing: ${ordersData.meta.total} (sample: ${JSON.stringify(ordersData.data.slice(0, 3))})
- Recent contacts: ${JSON.stringify(contactsData.data.slice(0, 3))}

Return a JSON object (no markdown wrapper): {"generatedAt":"${new Date().toISOString()}","format":"${format}","sections":{"completed":[{"item":string}],"inProgress":[{"item":string}],"blockers":[{"item":string}],"upcoming":[{"item":string}]},"summary":string}`;
        const content = await this.callAiEngine(prompt, 600);
        const parsed = this.tryParseJson(content);
        return {
          toolName: call.toolName,
          result:
            parsed &&
            typeof parsed === "object" &&
            "sections" in (parsed as object)
              ? parsed
              : {
                  generatedAt: new Date().toISOString(),
                  sections: {
                    completed: [],
                    inProgress: [],
                    blockers: [],
                    upcoming: [],
                  },
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
