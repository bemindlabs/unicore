/**
 * FinanceAgent — Transaction analysis & financial forecasting.
 *
 * Capabilities:
 *  - categorize_transaction  : Assign category + confidence to a raw transaction
 *  - list_transactions       : Query transactions with filters (date, category, amount)
 *  - generate_report         : Produce P&L, cash-flow, or expense summaries
 *  - forecast_cashflow       : Project cash flow over a given period
 *  - detect_anomalies        : Flag unusual spending patterns
 *  - create_invoice          : Generate and persist an invoice record
 *  - reconcile_accounts      : Match bank transactions against ERP records
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
export class FinanceAgent extends SpecialistAgentBase {
  readonly agentType: AgentType = 'finance';

  readonly config: SpecialistAgentConfig = {
    displayName: 'Finance Agent',
    description:
      'Analyses transactions, generates financial reports, and forecasts cash flow.',
    version: '0.1.0',
  };

  // -------------------------------------------------------------------------
  // System prompt
  // -------------------------------------------------------------------------

  protected buildSystemPrompt(context: AgentContext): string {
    const currency =
      (context.businessContext?.['currency'] as string | undefined) ?? 'USD';
    const businessName =
      (context.businessContext?.['businessName'] as string | undefined) ??
      'the business';

    return `You are the Finance Agent for ${businessName}.
Your role is to manage financial data with accuracy and transparency:
  - Categorise and analyse transactions (currency: ${currency})
  - Generate P&L, cash-flow, and expense reports
  - Forecast future cash positions based on historical patterns
  - Detect anomalies and alert on unusual spending
  - Create and manage invoices
  - Reconcile bank transactions against ERP records

Always present numbers with the correct currency symbol (${currency}).
When uncertain about a category, provide the top 2 candidates with confidence scores.
Never modify financial records without explicit user confirmation.

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
        name: 'categorize_transaction',
        description:
          'Assign a spending category and confidence score to a raw transaction.',
        parameters: {
          type: 'object',
          properties: {
            transactionId: {
              type: 'string',
              description: 'ERP transaction identifier',
            },
            description: {
              type: 'string',
              description: 'Raw transaction description / merchant name',
            },
            amount: {
              type: 'number',
              description: 'Transaction amount (positive=income, negative=expense)',
            },
            date: {
              type: 'string',
              description: 'ISO-8601 transaction date',
            },
          },
          required: ['description', 'amount'],
        },
      },
      {
        name: 'list_transactions',
        description: 'Query transactions with optional date range, category, and amount filters.',
        parameters: {
          type: 'object',
          properties: {
            from: {
              type: 'string',
              description: 'Start date (ISO-8601)',
            },
            to: {
              type: 'string',
              description: 'End date (ISO-8601)',
            },
            category: {
              type: 'string',
              description: 'Filter by category slug',
            },
            minAmount: {
              type: 'number',
              description: 'Minimum absolute amount',
            },
            maxAmount: {
              type: 'number',
              description: 'Maximum absolute amount',
            },
            limit: {
              type: 'number',
              description: 'Max records to return (default: 50)',
            },
          },
          required: [],
        },
      },
      {
        name: 'generate_report',
        description: 'Generate a financial report (P&L, cash-flow, or expense breakdown).',
        parameters: {
          type: 'object',
          properties: {
            reportType: {
              type: 'string',
              description: 'Type of report to generate',
              enum: ['pnl', 'cashflow', 'expenses', 'revenue'],
            },
            period: {
              type: 'string',
              description: 'Reporting period slug: this_month | last_month | this_quarter | ytd | custom',
              enum: ['this_month', 'last_month', 'this_quarter', 'ytd', 'custom'],
            },
            from: {
              type: 'string',
              description: 'Custom period start (ISO-8601) — required when period=custom',
            },
            to: {
              type: 'string',
              description: 'Custom period end (ISO-8601) — required when period=custom',
            },
            format: {
              type: 'string',
              description: 'Output format',
              enum: ['json', 'csv', 'pdf'],
            },
          },
          required: ['reportType', 'period'],
        },
      },
      {
        name: 'forecast_cashflow',
        description: 'Project future cash position using historical transaction patterns.',
        parameters: {
          type: 'object',
          properties: {
            horizonDays: {
              type: 'number',
              description: 'Number of days to forecast (7, 30, 90, 180)',
            },
            includeScheduled: {
              type: 'boolean',
              description: 'Include known future invoices and bills in the projection',
            },
            confidenceInterval: {
              type: 'number',
              description: 'Confidence interval percentage (default: 80)',
            },
          },
          required: ['horizonDays'],
        },
      },
      {
        name: 'detect_anomalies',
        description: 'Scan recent transactions for unusual patterns or outliers.',
        parameters: {
          type: 'object',
          properties: {
            lookbackDays: {
              type: 'number',
              description: 'How many days of history to analyse (default: 30)',
            },
            sensitivityLevel: {
              type: 'string',
              description: 'Anomaly detection sensitivity',
              enum: ['low', 'medium', 'high'],
            },
          },
          required: [],
        },
      },
      {
        name: 'create_invoice',
        description: 'Generate and persist a new invoice in the ERP.',
        parameters: {
          type: 'object',
          properties: {
            clientId: {
              type: 'string',
              description: 'ERP contact/client identifier',
            },
            lineItems: {
              type: 'array',
              description: 'Invoice line items',
              items: {
                type: 'object',
                description: 'A single invoice line',
                properties: {
                  description: { type: 'string', description: 'Line description' },
                  quantity: { type: 'number', description: 'Quantity' },
                  unitPrice: { type: 'number', description: 'Unit price' },
                },
              },
            },
            dueDate: {
              type: 'string',
              description: 'Payment due date (ISO-8601)',
            },
            notes: {
              type: 'string',
              description: 'Optional notes to appear on the invoice',
            },
          },
          required: ['clientId', 'lineItems'],
        },
      },
      {
        name: 'reconcile_accounts',
        description: 'Match imported bank transactions against ERP entries and flag discrepancies.',
        parameters: {
          type: 'object',
          properties: {
            accountId: {
              type: 'string',
              description: 'ERP bank account identifier to reconcile',
            },
            from: {
              type: 'string',
              description: 'Reconciliation start date (ISO-8601)',
            },
            to: {
              type: 'string',
              description: 'Reconciliation end date (ISO-8601)',
            },
          },
          required: ['accountId'],
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
    this.logger.debug(`[finance] executing tool: ${call.toolName}`);

    switch (call.toolName) {
      case 'categorize_transaction':
        return {
          toolName: call.toolName,
          result: {
            category: 'operating_expense',
            confidence: 0.87,
            alternativeCategory: 'cost_of_goods',
            alternativeConfidence: 0.12,
          },
        };

      case 'list_transactions':
        return {
          toolName: call.toolName,
          result: { transactions: [], total: 0, page: 1 },
        };

      case 'generate_report':
        return {
          toolName: call.toolName,
          result: {
            reportId: this.newId(),
            reportType: call.arguments['reportType'],
            period: call.arguments['period'],
            generatedAt: new Date().toISOString(),
            downloadUrl: null,
            summary: {},
          },
        };

      case 'forecast_cashflow':
        return {
          toolName: call.toolName,
          result: {
            horizonDays: call.arguments['horizonDays'],
            projectedBalance: 0,
            lowerBound: 0,
            upperBound: 0,
            dataPoints: [],
          },
        };

      case 'detect_anomalies':
        return {
          toolName: call.toolName,
          result: { anomalies: [], scannedCount: 0 },
        };

      case 'create_invoice':
        return {
          toolName: call.toolName,
          result: {
            invoiceId: this.newId(),
            invoiceNumber: `INV-${Date.now()}`,
            status: 'draft',
            totalAmount: 0,
            createdAt: new Date().toISOString(),
          },
        };

      case 'reconcile_accounts':
        return {
          toolName: call.toolName,
          result: {
            accountId: call.arguments['accountId'],
            matched: 0,
            unmatched: 0,
            discrepancies: [],
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
