import { Injectable } from '@nestjs/common';
import type { AgentType } from '../interfaces/agent-base.interface';

export interface MentionParseResult {
  /** First valid @mention found, or null if none present. */
  mention: AgentType | null;
  /** Message text with the leading @mention stripped (remaining text). */
  strippedContent: string;
  /** All valid @mentions found in the message, in order. */
  allMentions: AgentType[];
}

/** Set of recognised agent type identifiers for @mention resolution. */
const VALID_AGENT_TYPES = new Set<string>([
  'comms',
  'finance',
  'growth',
  'ops',
  'research',
  'erp',
  'builder',
  'sentinel',
]);

/**
 * MentionParserService
 *
 * Parses @agentType mentions from a user message to enable direct routing
 * to specialist agents mid-conversation, bypassing LLM intent classification.
 *
 * Example: "@finance what is our Q3 burn rate?" routes directly to FinanceAgent
 * with the stripped content "what is our Q3 burn rate?".
 *
 * Multiple mentions are captured but only the first drives routing.
 */
@Injectable()
export class MentionParserService {
  /**
   * Extract @mentions from content and strip the primary mention.
   *
   * @param content  Raw user message text.
   * @returns        Parse result containing the primary mention and cleaned content.
   */
  parse(content: string): MentionParseResult {
    const mentionRegex = /@(\w+)/g;
    const allMentions: AgentType[] = [];

    let match: RegExpExecArray | null;
    while ((match = mentionRegex.exec(content)) !== null) {
      const candidate = match[1].toLowerCase();
      if (VALID_AGENT_TYPES.has(candidate)) {
        allMentions.push(candidate as AgentType);
      }
    }

    const mention = allMentions.length > 0 ? allMentions[0] : null;

    // Strip only the first occurrence of the primary @mention so the rest of
    // the message is preserved as clean input for the target agent.
    const strippedContent = mention
      ? content.replace(new RegExp(`@${mention}\\b`, 'i'), '').replace(/\s{2,}/g, ' ').trim()
      : content;

    return { mention, strippedContent, allMentions };
  }
}
