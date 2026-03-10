/**
 * FinanceAgent — Transaction analysis & financial forecasting.
 */
import { Injectable } from '@nestjs/common';
import { AgentContext, AgentType } from '../../interfaces/agent-base.interface';
import { SpecialistAgentBase, SpecialistAgentConfig, ToolDefinition, ToolCall, ToolResult } from '../base/specialist-agent.base';

@Injectable()
export class FinanceAgent extends SpecialistAgentBase {
  readonly agentType: AgentType = 'finance';
  readonly config: SpecialistAgentConfig = {
    displayName: 'Finance Agent',
    description: 'Analyses transactions, generates financial reports, and forecasts cash flow.',
    version: '0.1.0',
  };

  protected buildSystemPrompt(context: AgentContext): string {
    const currency = (context.businessContext?.['currency'] as string | undefined) ?? 'USD';
    const businessName = (context.businessContext?.['businessName'] as string | undefined) ?? 'the business';
    return `You are the Finance Agent for ${businessName}. Currency: ${currency}. Available tools: ${this.getToolDefinitions().map((t) => t.name).join(', ')}.`;
  }

  getToolDefinitions(): ToolDefinition[] {
    return [
      { name: 'categorize_transaction', description: 'Assign a spending category and confidence score to a raw transaction.', parameters: { type: 'object', properties: { transactionId: { type: 'string', description: 'ERP transaction identifier' }, description: { type: 'string', description: 'Raw transaction description' }, amount: { type: 'number', description: 'Transaction amount' }, date: { type: 'string', description: 'ISO-8601 transaction date' } }, required: ['description', 'amount'] } },
      { name: 'list_transactions', description: 'Query transactions with optional filters.', parameters: { type: 'object', properties: { from: { type: 'string', description: 'Start date' }, to: { type: 'string', description: 'End date' }, category: { type: 'string', description: 'Filter by category' }, minAmount: { type: 'number', description: 'Minimum amount' }, maxAmount: { type: 'number', description: 'Maximum amount' }, limit: { type: 'number', description: 'Max records' } }, required: [] } },
      { name: 'generate_report', description: 'Generate a financial report (P&L, cash-flow, or expense breakdown).', parameters: { type: 'object', properties: { reportType: { type: 'string', description: 'Type of report', enum: ['pnl', 'cashflow', 'expenses', 'revenue'] }, period: { type: 'string', description: 'Reporting period', enum: ['this_month', 'last_month', 'this_quarter', 'ytd', 'custom'] }, from: { type: 'string', description: 'Custom period start' }, to: { type: 'string', description: 'Custom period end' }, format: { type: 'string', description: 'Output format', enum: ['json', 'csv', 'pdf'] } }, required: ['reportType', 'period'] } },
      { name: 'forecast_cashflow', description: 'Project future cash position using historical transaction patterns.', parameters: { type: 'object', properties: { horizonDays: { type: 'number', description: 'Number of days to forecast' }, includeScheduled: { type: 'boolean', description: 'Include known future invoices' }, confidenceInterval: { type: 'number', description: 'Confidence interval %' } }, required: ['horizonDays'] } },
      { name: 'detect_anomalies', description: 'Scan recent transactions for unusual patterns or outliers.', parameters: { type: 'object', properties: { lookbackDays: { type: 'number', description: 'Days of history to analyse' }, sensitivityLevel: { type: 'string', description: 'Detection sensitivity', enum: ['low', 'medium', 'high'] } }, required: [] } },
      { name: 'create_invoice', description: 'Generate and persist a new invoice in the ERP.', parameters: { type: 'object', properties: { clientId: { type: 'string', description: 'ERP client identifier' }, lineItems: { type: 'array', description: 'Invoice line items', items: { type: 'object', description: 'Invoice line', properties: { description: { type: 'string', description: 'Line description' }, quantity: { type: 'number', description: 'Quantity' }, unitPrice: { type: 'number', description: 'Unit price' } } } }, dueDate: { type: 'string', description: 'Payment due date' }, notes: { type: 'string', description: 'Optional notes' } }, required: ['clientId', 'lineItems'] } },
      { name: 'reconcile_accounts', description: 'Match bank transactions against ERP entries and flag discrepancies.', parameters: { type: 'object', properties: { accountId: { type: 'string', description: 'ERP bank account identifier' }, from: { type: 'string', description: 'Start date' }, to: { type: 'string', description: 'End date' } }, required: ['accountId'] } },
    ];
  }

  protected async executeTool(call: ToolCall, _context: AgentContext): Promise<ToolResult> {
    this.logger.debug(`[finance] executing tool: ${call.toolName}`);
    switch (call.toolName) {
      case 'categorize_transaction': return { toolName: call.toolName, result: { category: 'operating_expense', confidence: 0.87 } };
      case 'list_transactions': return { toolName: call.toolName, result: { transactions: [], total: 0 } };
      case 'generate_report': return { toolName: call.toolName, result: { reportId: this.newId(), reportType: call.arguments['reportType'], generatedAt: new Date().toISOString() } };
      case 'forecast_cashflow': return { toolName: call.toolName, result: { horizonDays: call.arguments['horizonDays'], projectedBalance: 0, dataPoints: [] } };
      case 'detect_anomalies': return { toolName: call.toolName, result: { anomalies: [], scannedCount: 0 } };
      case 'create_invoice': return { toolName: call.toolName, result: { invoiceId: this.newId(), status: 'draft', createdAt: new Date().toISOString() } };
      case 'reconcile_accounts': return { toolName: call.toolName, result: { accountId: call.arguments['accountId'], matched: 0, unmatched: 0, discrepancies: [] } };
      default: return { toolName: call.toolName, result: null, error: `Unknown tool: ${call.toolName}` };
    }
  }
}
