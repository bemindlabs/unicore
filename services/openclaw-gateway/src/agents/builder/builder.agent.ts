/**
 * BuilderAgent — Code generation & workflow building.
 *
 * Capabilities:
 *  - generate_code        : Generate TypeScript/Python/SQL code from a description
 *  - create_workflow      : Scaffold an automation workflow from natural language
 *  - scaffold_api         : Generate NestJS controller + service + DTO for an entity
 *  - write_tests          : Generate unit or integration tests for a code snippet
 *  - review_code          : Analyse code for bugs, style issues, and security concerns
 *  - create_webhook       : Register a new webhook endpoint
 *  - deploy_function      : Prepare and queue a serverless function for deployment
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
export class BuilderAgent extends SpecialistAgentBase {
  readonly agentType: AgentType = 'builder';

  readonly config: SpecialistAgentConfig = {
    displayName: 'Builder Agent',
    description:
      'Generates code, scaffolds workflows, and automates technical build tasks.',
    version: '0.1.0',
  };

  // -------------------------------------------------------------------------
  // System prompt
  // -------------------------------------------------------------------------

  protected buildSystemPrompt(context: AgentContext): string {
    const businessName =
      (context.businessContext?.['businessName'] as string | undefined) ??
      'the business';

    return `You are the Builder Agent for ${businessName}.
You are a senior full-stack engineer specialising in TypeScript 5.5+, NestJS, Next.js 14, and PostgreSQL.
Your role is to:
  - Generate production-quality code snippets and full modules
  - Scaffold API endpoints, workflows, and integrations from plain descriptions
  - Write comprehensive tests (unit, integration) for generated or provided code
  - Review code for correctness, security vulnerabilities, and style adherence
  - Create and manage webhook endpoints
  - Prepare serverless functions for deployment

Always follow:
  - TypeScript strict mode with ES2022 targets
  - NestJS patterns (Injectable, Module, Controller, Service)
  - Single-responsibility principle
  - Include JSDoc for public APIs
  - Write tests using Jest with @nestjs/testing

Confirm destructive operations (deployments, webhook creation) before executing.

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
        name: 'generate_code',
        description: 'Generate code from a natural language description.',
        parameters: {
          type: 'object',
          properties: {
            description: {
              type: 'string',
              description: 'What the code should do',
            },
            language: {
              type: 'string',
              description: 'Target programming language',
              enum: ['typescript', 'python', 'sql', 'javascript', 'shell'],
            },
            framework: {
              type: 'string',
              description: 'Framework or library context (e.g. nestjs, nextjs, prisma)',
            },
            style: {
              type: 'string',
              description: 'Code style preferences',
              enum: ['functional', 'class_based', 'mixed'],
            },
            includeTests: {
              type: 'boolean',
              description: 'If true, also generate test stubs for the code',
            },
          },
          required: ['description', 'language'],
        },
      },
      {
        name: 'create_workflow',
        description: 'Scaffold an automation workflow from a natural language description.',
        parameters: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Workflow name (slug-safe)',
            },
            description: {
              type: 'string',
              description: 'What the workflow should do end-to-end',
            },
            trigger: {
              type: 'object',
              description: 'What initiates the workflow',
              properties: {
                type: {
                  type: 'string',
                  enum: ['webhook', 'schedule', 'event', 'manual'],
                  description: 'Trigger type',
                },
                config: {
                  type: 'string',
                  description: 'Trigger configuration (cron expression, event name, or URL)',
                },
              },
            },
            steps: {
              type: 'array',
              description: 'High-level workflow step descriptions',
              items: { type: 'string', description: 'Step description' },
            },
          },
          required: ['name', 'description'],
        },
      },
      {
        name: 'scaffold_api',
        description: 'Generate a complete NestJS module: controller, service, DTOs, and module file.',
        parameters: {
          type: 'object',
          properties: {
            entityName: {
              type: 'string',
              description: 'Name of the entity (singular, PascalCase, e.g. "Product")',
            },
            fields: {
              type: 'array',
              description: 'Entity field definitions',
              items: {
                type: 'object',
                description: 'Field definition',
                properties: {
                  name: { type: 'string', description: 'Field name (camelCase)' },
                  type: { type: 'string', description: 'TypeScript type (string, number, boolean, Date)' },
                  required: { type: 'boolean', description: 'Whether the field is required' },
                },
              },
            },
            operations: {
              type: 'array',
              description: 'CRUD operations to generate',
              items: {
                type: 'string',
                description: 'CRUD operation name',
                enum: ['create', 'read', 'update', 'delete', 'list'],
              },
            },
            includeAuth: {
              type: 'boolean',
              description: 'Whether to add JwtAuthGuard to the controller',
            },
          },
          required: ['entityName', 'fields'],
        },
      },
      {
        name: 'write_tests',
        description: 'Generate Jest unit or integration tests for a given code snippet or module.',
        parameters: {
          type: 'object',
          properties: {
            targetCode: {
              type: 'string',
              description: 'The code to write tests for (TypeScript source)',
            },
            testType: {
              type: 'string',
              description: 'Type of tests to generate',
              enum: ['unit', 'integration', 'e2e'],
            },
            coverageTargets: {
              type: 'array',
              description: 'Specific functions or methods to prioritise in test coverage',
              items: { type: 'string', description: 'Function/method name' },
            },
          },
          required: ['targetCode', 'testType'],
        },
      },
      {
        name: 'review_code',
        description: 'Analyse a code snippet for bugs, security issues, and style improvements.',
        parameters: {
          type: 'object',
          properties: {
            code: {
              type: 'string',
              description: 'Source code to review',
            },
            language: {
              type: 'string',
              description: 'Programming language of the code',
              enum: ['typescript', 'python', 'sql', 'javascript'],
            },
            focus: {
              type: 'array',
              description: 'Aspects to focus the review on',
              items: {
                type: 'string',
                description: 'Review focus area',
                enum: ['bugs', 'security', 'performance', 'style', 'types', 'all'],
              },
            },
          },
          required: ['code'],
        },
      },
      {
        name: 'create_webhook',
        description: 'Register a new inbound webhook endpoint on the API gateway.',
        parameters: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Descriptive name for the webhook',
            },
            path: {
              type: 'string',
              description: 'URL path for the webhook (e.g. /webhooks/stripe)',
            },
            method: {
              type: 'string',
              description: 'HTTP method',
              enum: ['POST', 'PUT', 'PATCH'],
            },
            handlerDescription: {
              type: 'string',
              description: 'What the webhook handler should do when triggered',
            },
            secretValidation: {
              type: 'boolean',
              description: 'Whether to validate a shared secret header',
            },
          },
          required: ['name', 'path', 'handlerDescription'],
        },
      },
      {
        name: 'deploy_function',
        description: 'Prepare and queue a serverless function for deployment.',
        parameters: {
          type: 'object',
          properties: {
            functionName: {
              type: 'string',
              description: 'Name of the function to deploy (slug-safe)',
            },
            runtime: {
              type: 'string',
              description: 'Execution runtime',
              enum: ['nodejs20', 'python311', 'deno'],
            },
            sourceCode: {
              type: 'string',
              description: 'Complete function source code',
            },
            environment: {
              type: 'string',
              description: 'Target environment',
              enum: ['staging', 'production'],
            },
            envVars: {
              type: 'object',
              description: 'Environment variables to inject (key-value pairs)',
              properties: {},
            },
          },
          required: ['functionName', 'runtime', 'sourceCode'],
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
    this.logger.debug(`[builder] executing tool: ${call.toolName}`);

    switch (call.toolName) {
      case 'generate_code':
        return {
          toolName: call.toolName,
          result: {
            language: call.arguments['language'],
            code: `// Generated ${call.arguments['language']} code\n// TODO: LLM integration pending\n`,
            tests: call.arguments['includeTests'] ? '// TODO: test stubs\n' : null,
          },
        };

      case 'create_workflow':
        return {
          toolName: call.toolName,
          result: {
            workflowId: this.newId(),
            name: call.arguments['name'],
            status: 'draft',
            createdAt: new Date().toISOString(),
          },
        };

      case 'scaffold_api': {
        const entityName = String(call.arguments['entityName'] ?? 'entity');
        return {
          toolName: call.toolName,
          result: {
            entity: entityName,
            generatedFiles: [
              `${entityName.toLowerCase()}.module.ts`,
              `${entityName.toLowerCase()}.controller.ts`,
              `${entityName.toLowerCase()}.service.ts`,
              `dto/create-${entityName.toLowerCase()}.dto.ts`,
              `dto/update-${entityName.toLowerCase()}.dto.ts`,
            ],
            status: 'stub — LLM generation pending',
          },
        };
      }

      case 'write_tests':
        return {
          toolName: call.toolName,
          result: {
            testType: call.arguments['testType'],
            generatedTests: '// TODO: generated tests stub\n',
            estimatedCoverage: '0%',
          },
        };

      case 'review_code':
        return {
          toolName: call.toolName,
          result: {
            issues: [],
            suggestions: [],
            securityFindings: [],
            overallRating: 'pending',
          },
        };

      case 'create_webhook':
        return {
          toolName: call.toolName,
          result: {
            webhookId: this.newId(),
            path: call.arguments['path'],
            name: call.arguments['name'],
            status: 'registered',
            createdAt: new Date().toISOString(),
          },
        };

      case 'deploy_function':
        return {
          toolName: call.toolName,
          result: {
            deploymentId: this.newId(),
            functionName: call.arguments['functionName'],
            runtime: call.arguments['runtime'],
            environment: call.arguments['environment'] ?? 'staging',
            status: 'queued',
            queuedAt: new Date().toISOString(),
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
