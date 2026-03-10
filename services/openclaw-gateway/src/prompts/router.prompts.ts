import type { IntentCategory } from '../interfaces/agent-base.interface';

/**
 * Human-readable descriptions of each intent category.
 * These are embedded into the system prompt to guide the model.
 */
export const INTENT_DESCRIPTIONS: Record<IntentCategory, string> = {
  comms:
    'Communication and messaging — drafting replies, inbox management, customer outreach, ' +
    'email campaigns, social media responses, chat conversations.',
  finance:
    'Financial operations — transaction categorization, invoicing, expense tracking, ' +
    'cash flow forecasting, budget analysis, payment processing.',
  growth:
    'Marketing and growth — funnel analysis, A/B testing, ad performance monitoring, ' +
    'SEO, conversion optimization, growth experiments.',
  ops:
    'Operations and project management — task creation, scheduling, deadline tracking, ' +
    'project status, team coordination, calendar management.',
  research:
    'Research and intelligence — market analysis, competitor monitoring, industry news ' +
    'summarization, trend identification, data gathering.',
  erp:
    'ERP and business data — CRM contacts, order management, inventory queries, ' +
    'customer records, stock levels, fulfillment status.',
  builder:
    'Technical and development — code generation, deployment automation, infrastructure ' +
    'management, API integration, debugging assistance.',
  unknown:
    'The intent does not clearly match any specialist domain, or the request is ambiguous.',
};

/**
 * Build the system prompt for the Router Agent classification task.
 */
export function buildClassificationSystemPrompt(): string {
  const intentList = (
    Object.entries(INTENT_DESCRIPTIONS) as [IntentCategory, string][]
  )
    .filter(([key]) => key !== 'unknown')
    .map(([key, desc]) => `  - **${key}**: ${desc}`)
    .join('\n');

  return `You are the Router Agent for UniCore — an AI-first business operating system.

Your only job is to classify the user's intent into exactly ONE of the following categories,
then return a structured JSON response. Do NOT attempt to answer the user's question yourself.

## Intent Categories

${intentList}
  - **unknown**: Use this only when the intent genuinely does not fit any category above,
    or when the message is too vague to classify.

## Response Format

Respond with a single JSON object in this exact structure:
\`\`\`json
{
  "intent": "<category>",
  "confidence": <0.0–1.0>,
  "reasoning": "<one sentence explaining why this category was chosen>",
  "alternates": [
    { "intent": "<category>", "confidence": <0.0–1.0> }
  ]
}
\`\`\`

Rules:
- "intent" must be one of: comms, finance, growth, ops, research, erp, builder, unknown
- "confidence" must be a decimal between 0.0 and 1.0
- "alternates" should contain the next 1–2 most likely intents if confidence < 0.85; otherwise omit or leave empty
- "reasoning" must be a single concise sentence
- Respond ONLY with the JSON object — no markdown wrapping, no extra text`;
}

/**
 * Build the user-turn prompt for a classification request.
 */
export function buildClassificationUserPrompt(userMessage: string): string {
  return `Classify the following user message:\n\n"${userMessage}"`;
}

/**
 * Fallback response returned when classification fails or produces unknown intent.
 */
export const FALLBACK_RESPONSE_TEMPLATE = `I wasn't sure which part of UniCore can best help you with that.
Could you provide a bit more detail? For example:

- **Messaging / outreach** — I'll connect you with the Comms Agent
- **Invoices / finances** — the Finance Agent can help
- **Tasks / scheduling** — the Ops Agent is ready
- **ERP data (contacts, orders, inventory)** — the ERP Agent can look that up
- **Market research** — the Research Agent can dig in
- **Growth / marketing** — the Growth Agent is on it
- **Code / deployments** — the Builder Agent can assist`;
