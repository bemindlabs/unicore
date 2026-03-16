/**
 * FinanceAgent — Transaction analysis & financial forecasting.
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
export class FinanceAgent extends SpecialistAgentBase {
  readonly agentType: AgentType = "finance";
  readonly config: SpecialistAgentConfig = {
    displayName: "Finance Agent",
    description:
      "Analyses transactions, generates financial reports, and forecasts cash flow.",
    version: "0.1.0",
  };

  protected buildSystemPrompt(context: AgentContext): string {
    const currency =
      (context.businessContext?.["currency"] as string | undefined) ?? "USD";
    const businessName =
      (context.businessContext?.["businessName"] as string | undefined) ??
      "the business";
    return `You are the Finance Agent for ${businessName}. Currency: ${currency}. Available tools: ${this.getToolDefinitions()
      .map((t) => t.name)
      .join(", ")}.`;
  }

  getToolDefinitions(): ToolDefinition[] {
    return [
      {
        name: "categorize_transaction",
        description:
          "Assign a spending category and confidence score to a raw transaction.",
        parameters: {
          type: "object",
          properties: {
            transactionId: {
              type: "string",
              description: "ERP transaction identifier",
            },
            description: {
              type: "string",
              description: "Raw transaction description",
            },
            amount: { type: "number", description: "Transaction amount" },
            date: { type: "string", description: "ISO-8601 transaction date" },
          },
          required: ["description", "amount"],
        },
      },
      {
        name: "list_transactions",
        description: "Query transactions with optional filters.",
        parameters: {
          type: "object",
          properties: {
            from: { type: "string", description: "Start date" },
            to: { type: "string", description: "End date" },
            category: { type: "string", description: "Filter by category" },
            minAmount: { type: "number", description: "Minimum amount" },
            maxAmount: { type: "number", description: "Maximum amount" },
            limit: { type: "number", description: "Max records" },
          },
          required: [],
        },
      },
      {
        name: "generate_report",
        description:
          "Generate a financial report (P&L, cash-flow, or expense breakdown).",
        parameters: {
          type: "object",
          properties: {
            reportType: {
              type: "string",
              description: "Type of report",
              enum: ["pnl", "cashflow", "expenses", "revenue"],
            },
            period: {
              type: "string",
              description: "Reporting period",
              enum: [
                "this_month",
                "last_month",
                "this_quarter",
                "ytd",
                "custom",
              ],
            },
            from: { type: "string", description: "Custom period start" },
            to: { type: "string", description: "Custom period end" },
            format: {
              type: "string",
              description: "Output format",
              enum: ["json", "csv", "pdf"],
            },
          },
          required: ["reportType", "period"],
        },
      },
      {
        name: "forecast_cashflow",
        description:
          "Project future cash position using historical transaction patterns.",
        parameters: {
          type: "object",
          properties: {
            horizonDays: {
              type: "number",
              description: "Number of days to forecast",
            },
            includeScheduled: {
              type: "boolean",
              description: "Include known future invoices",
            },
            confidenceInterval: {
              type: "number",
              description: "Confidence interval %",
            },
          },
          required: ["horizonDays"],
        },
      },
      {
        name: "detect_anomalies",
        description:
          "Scan recent transactions for unusual patterns or outliers.",
        parameters: {
          type: "object",
          properties: {
            lookbackDays: {
              type: "number",
              description: "Days of history to analyse",
            },
            sensitivityLevel: {
              type: "string",
              description: "Detection sensitivity",
              enum: ["low", "medium", "high"],
            },
          },
          required: [],
        },
      },
      {
        name: "create_invoice",
        description: "Generate and persist a new invoice in the ERP.",
        parameters: {
          type: "object",
          properties: {
            clientId: { type: "string", description: "ERP client identifier" },
            lineItems: {
              type: "array",
              description: "Invoice line items",
              items: {
                type: "object",
                description: "Invoice line",
                properties: {
                  description: {
                    type: "string",
                    description: "Line description",
                  },
                  quantity: { type: "number", description: "Quantity" },
                  unitPrice: { type: "number", description: "Unit price" },
                },
              },
            },
            dueDate: { type: "string", description: "Payment due date" },
            notes: { type: "string", description: "Optional notes" },
          },
          required: ["clientId", "lineItems"],
        },
      },
      {
        name: "reconcile_accounts",
        description:
          "Match bank transactions against ERP entries and flag discrepancies.",
        parameters: {
          type: "object",
          properties: {
            accountId: {
              type: "string",
              description: "ERP bank account identifier",
            },
            from: { type: "string", description: "Start date" },
            to: { type: "string", description: "End date" },
          },
          required: ["accountId"],
        },
      },
    ];
  }

  private get AI_ENGINE_URL(): string {
    return process.env["AI_ENGINE_URL"] ?? "http://localhost:4200";
  }

  private get ERP_SERVICE_URL(): string {
    return process.env["ERP_SERVICE_URL"] ?? "http://localhost:4100";
  }

  protected async executeTool(
    call: ToolCall,
    _context: AgentContext,
  ): Promise<ToolResult> {
    this.logger.debug(`[finance] executing tool: ${call.toolName}`);
    try {
    switch (call.toolName) {
      case "categorize_transaction": {
        const res = await fetch(`${this.AI_ENGINE_URL}/llm/invoke`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: `Categorize this transaction: description="${call.arguments["description"]}", amount=${call.arguments["amount"]}, date=${call.arguments["date"] ?? "unknown"}, id=${call.arguments["transactionId"] ?? "unknown"}. Return a spending category and confidence score.`,
          }),
        });
        const data = await res.json();
        return { toolName: call.toolName, result: data };
      }
      case "list_transactions": {
        const params = new URLSearchParams();
        if (call.arguments["from"] != null)
          params.set("from", String(call.arguments["from"]));
        if (call.arguments["to"] != null)
          params.set("to", String(call.arguments["to"]));
        if (call.arguments["category"] != null)
          params.set("category", String(call.arguments["category"]));
        if (call.arguments["minAmount"] != null)
          params.set("minAmount", String(call.arguments["minAmount"]));
        if (call.arguments["maxAmount"] != null)
          params.set("maxAmount", String(call.arguments["maxAmount"]));
        if (call.arguments["limit"] != null)
          params.set("limit", String(call.arguments["limit"]));
        const res = await fetch(
          `${this.ERP_SERVICE_URL}/finance/transactions?${params.toString()}`,
        );
        const data = await res.json();
        return { toolName: call.toolName, result: data };
      }
      case "generate_report": {
        const res = await fetch(
          `${this.ERP_SERVICE_URL}/finance/reports/generate`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(call.arguments),
          },
        );
        const data = await res.json();
        return { toolName: call.toolName, result: data };
      }
      case "forecast_cashflow": {
        const params = new URLSearchParams();
        params.set("horizonDays", String(call.arguments["horizonDays"]));
        if (call.arguments["includeScheduled"] != null)
          params.set(
            "includeScheduled",
            String(call.arguments["includeScheduled"]),
          );
        if (call.arguments["confidenceInterval"] != null)
          params.set(
            "confidenceInterval",
            String(call.arguments["confidenceInterval"]),
          );
        const cashflowRes = await fetch(
          `${this.ERP_SERVICE_URL}/finance/cashflow?${params.toString()}`,
        );
        const cashflowData = await cashflowRes.json();
        const res = await fetch(`${this.AI_ENGINE_URL}/llm/invoke`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: `Forecast cashflow for the next ${call.arguments["horizonDays"]} days based on this data: ${JSON.stringify(cashflowData)}`,
          }),
        });
        const data = await res.json();
        return { toolName: call.toolName, result: data };
      }
      case "detect_anomalies": {
        const res = await fetch(`${this.AI_ENGINE_URL}/llm/invoke`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: `Detect anomalies in transactions. Lookback days: ${call.arguments["lookbackDays"] ?? 30}. Sensitivity: ${call.arguments["sensitivityLevel"] ?? "medium"}.`,
          }),
        });
        const data = await res.json();
        return { toolName: call.toolName, result: data };
      }
      case "create_invoice": {
        const res = await fetch(
          `${this.ERP_SERVICE_URL}/finance/invoices`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(call.arguments),
          },
        );
        const data = await res.json();
        return { toolName: call.toolName, result: data };
      }
      case "reconcile_accounts": {
        const res = await fetch(
          `${this.ERP_SERVICE_URL}/finance/reconcile`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(call.arguments),
          },
        );
        const data = await res.json();
        return { toolName: call.toolName, result: data };
      }
      default:
        return {
          toolName: call.toolName,
          result: null,
          error: `Unknown tool: ${call.toolName}`,
        };
    }
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return {
        toolName: call.toolName,
        result: null,
        error: error.message,
      };
    }
  }
}
