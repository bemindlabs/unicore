/**
 * ErpAgent — Natural language CRUD operations on ERP data.
 *
 * Capabilities:
 *  - nl_query         : Translate a natural language request into an ERP read query
 *  - create_record    : Create a new ERP record (contact, order, product, invoice, expense)
 *  - update_record    : Update an existing ERP record via NL instructions
 *  - delete_record    : Soft-delete an ERP record with confirmation
 *  - bulk_update      : Apply the same change across multiple matching records
 *  - export_data      : Export a filtered data set as CSV, JSON, or PDF
 *  - generate_summary : Produce a natural language summary of ERP data for a module
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

export type ErpModule =
  | 'contacts'
  | 'orders'
  | 'products'
  | 'inventory'
  | 'invoices'
  | 'expenses'
  | 'suppliers';

@Injectable()
export class ErpAgent extends SpecialistAgentBase {
  readonly agentType: AgentType = 'erp';

  readonly config: SpecialistAgentConfig = {
    displayName: 'ERP Agent',
    description:
      'Provides natural-language access to ERP data — read, create, update, and export records conversationally.',
    version: '0.1.0',
  };

  // -------------------------------------------------------------------------
  // System prompt
  // -------------------------------------------------------------------------

  protected buildSystemPrompt(context: AgentContext): string {
    const businessName =
      (context.businessContext?.['businessName'] as string | undefined) ??
      'the business';
    const enabledModules =
      (context.businessContext?.['erpModules'] as string[] | undefined) ??
      ['contacts', 'orders', 'products', 'inventory', 'invoices', 'expenses'];

    return `You are the ERP Agent for ${businessName}.
You provide natural-language access to the following ERP modules: ${enabledModules.join(', ')}.

Your role is to:
  - Interpret natural language requests and translate them into precise ERP operations
  - Read and summarise ERP data in plain English
  - Create, update, and (with confirmation) delete records
  - Execute bulk operations across multiple matching records
  - Export filtered data sets on request

Always show a preview of the operation before executing writes or deletes.
Validate that required fields are present before attempting to create records.
Never expose system IDs unnecessarily — use human-readable labels in responses.

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
        name: 'nl_query',
        description: 'Translate a natural language question into an ERP query and return matching records.',
        parameters: {
          type: 'object',
          properties: {
            module: {
              type: 'string',
              description: 'ERP module to query',
              enum: ['contacts', 'orders', 'products', 'inventory', 'invoices', 'expenses', 'suppliers'],
            },
            naturalLanguageQuery: {
              type: 'string',
              description: 'The user\'s natural language request (e.g. "show me all unpaid invoices from last month")',
            },
            limit: {
              type: 'number',
              description: 'Max records to return',
            },
            format: {
              type: 'string',
              description: 'Response format',
              enum: ['table', 'list', 'summary'],
            },
          },
          required: ['module', 'naturalLanguageQuery'],
        },
      },
      {
        name: 'create_record',
        description: 'Create a new ERP record in the specified module.',
        parameters: {
          type: 'object',
          properties: {
            module: {
              type: 'string',
              description: 'Target ERP module',
              enum: ['contacts', 'orders', 'products', 'inventory', 'invoices', 'expenses', 'suppliers'],
            },
            fields: {
              type: 'object',
              description: 'Record field values (schema varies by module)',
              properties: {
                name: { type: 'string', description: 'Record name or title' },
                email: { type: 'string', description: 'Email address (contacts)' },
                phone: { type: 'string', description: 'Phone number (contacts)' },
                amount: { type: 'number', description: 'Monetary amount (orders, invoices, expenses)' },
                status: { type: 'string', description: 'Record status' },
                notes: { type: 'string', description: 'Additional notes' },
              },
            },
          },
          required: ['module', 'fields'],
        },
      },
      {
        name: 'update_record',
        description: 'Update fields on an existing ERP record using natural language instructions.',
        parameters: {
          type: 'object',
          properties: {
            module: {
              type: 'string',
              description: 'ERP module containing the record',
              enum: ['contacts', 'orders', 'products', 'inventory', 'invoices', 'expenses', 'suppliers'],
            },
            recordId: {
              type: 'string',
              description: 'ERP record identifier',
            },
            changes: {
              type: 'object',
              description: 'Field-value pairs to update',
              properties: {
                status: { type: 'string', description: 'New status value' },
                amount: { type: 'number', description: 'Updated amount' },
                notes: { type: 'string', description: 'Updated notes' },
                assigneeId: { type: 'string', description: 'New assignee user ID' },
              },
            },
            reason: {
              type: 'string',
              description: 'Reason for the update (for audit log)',
            },
          },
          required: ['module', 'recordId', 'changes'],
        },
      },
      {
        name: 'delete_record',
        description: 'Soft-delete an ERP record. Always requires user confirmation.',
        parameters: {
          type: 'object',
          properties: {
            module: {
              type: 'string',
              description: 'ERP module',
              enum: ['contacts', 'orders', 'products', 'inventory', 'invoices', 'expenses', 'suppliers'],
            },
            recordId: {
              type: 'string',
              description: 'Record to delete',
            },
            reason: {
              type: 'string',
              description: 'Deletion reason (required for audit trail)',
            },
          },
          required: ['module', 'recordId', 'reason'],
        },
      },
      {
        name: 'bulk_update',
        description: 'Apply the same field changes to all records matching a filter in a module.',
        parameters: {
          type: 'object',
          properties: {
            module: {
              type: 'string',
              description: 'ERP module',
              enum: ['contacts', 'orders', 'products', 'inventory', 'invoices', 'expenses'],
            },
            filter: {
              type: 'object',
              description: 'Criteria that records must match to be updated',
              properties: {
                status: { type: 'string', description: 'Current status to filter on' },
                tag: { type: 'string', description: 'Tag to filter on' },
                assigneeId: { type: 'string', description: 'Assignee to filter on' },
              },
            },
            changes: {
              type: 'object',
              description: 'Changes to apply to all matching records',
              properties: {
                status: { type: 'string', description: 'New status' },
                assigneeId: { type: 'string', description: 'New assignee' },
                tag: { type: 'string', description: 'Tag to add' },
              },
            },
          },
          required: ['module', 'filter', 'changes'],
        },
      },
      {
        name: 'export_data',
        description: 'Export a filtered ERP data set as CSV, JSON, or PDF.',
        parameters: {
          type: 'object',
          properties: {
            module: {
              type: 'string',
              description: 'ERP module to export from',
              enum: ['contacts', 'orders', 'products', 'inventory', 'invoices', 'expenses', 'suppliers'],
            },
            filter: {
              type: 'object',
              description: 'Filter criteria for the export',
              properties: {
                status: { type: 'string', description: 'Status filter' },
                from: { type: 'string', description: 'Start date (ISO-8601)' },
                to: { type: 'string', description: 'End date (ISO-8601)' },
              },
            },
            format: {
              type: 'string',
              description: 'Export file format',
              enum: ['csv', 'json', 'pdf'],
            },
            columns: {
              type: 'array',
              description: 'Specific columns to include (default: all)',
              items: { type: 'string', description: 'Column/field name' },
            },
          },
          required: ['module', 'format'],
        },
      },
      {
        name: 'generate_summary',
        description: 'Produce a natural-language summary of a given ERP module\'s current state.',
        parameters: {
          type: 'object',
          properties: {
            module: {
              type: 'string',
              description: 'ERP module to summarise',
              enum: ['contacts', 'orders', 'products', 'inventory', 'invoices', 'expenses'],
            },
            perspective: {
              type: 'string',
              description: 'Summary lens',
              enum: ['health', 'activity', 'financial', 'operational'],
            },
          },
          required: ['module'],
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
    this.logger.debug(`[erp] executing tool: ${call.toolName}`);

    switch (call.toolName) {
      case 'nl_query':
        return {
          toolName: call.toolName,
          result: {
            module: call.arguments['module'],
            records: [],
            total: 0,
            query: call.arguments['naturalLanguageQuery'],
          },
        };

      case 'create_record':
        return {
          toolName: call.toolName,
          result: {
            recordId: this.newId(),
            module: call.arguments['module'],
            status: 'created',
            createdAt: new Date().toISOString(),
          },
        };

      case 'update_record':
        return {
          toolName: call.toolName,
          result: {
            recordId: call.arguments['recordId'],
            module: call.arguments['module'],
            updated: true,
            updatedAt: new Date().toISOString(),
          },
        };

      case 'delete_record':
        return {
          toolName: call.toolName,
          result: {
            recordId: call.arguments['recordId'],
            module: call.arguments['module'],
            deleted: true,
            deletedAt: new Date().toISOString(),
          },
        };

      case 'bulk_update':
        return {
          toolName: call.toolName,
          result: {
            module: call.arguments['module'],
            matchedCount: 0,
            updatedCount: 0,
          },
        };

      case 'export_data':
        return {
          toolName: call.toolName,
          result: {
            exportId: this.newId(),
            module: call.arguments['module'],
            format: call.arguments['format'],
            downloadUrl: null,
            recordCount: 0,
          },
        };

      case 'generate_summary':
        return {
          toolName: call.toolName,
          result: {
            module: call.arguments['module'],
            summary: `Summary for ${call.arguments['module']} is not yet available (stub).`,
            metrics: {},
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
