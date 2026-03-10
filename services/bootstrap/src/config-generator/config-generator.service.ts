import { Injectable } from '@nestjs/common';
import type { Template } from '../common/interfaces/template.interface';
import type { ProvisionRequestDto } from '../dto/provision-request.dto';

export interface UniCoreConfig {
  business: {
    name: string;
    template: string;
    industry?: string;
    locale: string;
    currency: string;
    timezone: string;
  };
  roles: Array<{
    role: string;
    enabled: boolean;
  }>;
  agents: Array<{
    type: string;
    enabled: boolean;
    autonomy: string;
    channels?: string[];
  }>;
  erp: {
    modules: {
      contacts: boolean;
      orders: boolean;
      inventory: boolean;
      invoicing: boolean;
      expenses: boolean;
      reports: boolean;
    };
    currency: string;
    timezone: string;
  };
  integrations: Array<{
    name: string;
    enabled: boolean;
    provider: string;
    config: Record<string, unknown>;
  }>;
}

const AGENT_TYPE_MAP: Record<string, string> = {
  comms: 'comms',
  finance: 'finance',
  growth: 'growth',
  ops: 'ops',
  research: 'research',
  erp: 'erp',
  builder: 'builder',
};

const ALL_ROLES = ['owner', 'operator', 'marketer', 'finance', 'viewer'];

@Injectable()
export class ConfigGeneratorService {
  generate(request: ProvisionRequestDto, template: Template): UniCoreConfig {
    return {
      business: {
        name: request.businessName,
        template: request.template,
        ...(request.industry && { industry: request.industry }),
        locale: request.locale,
        currency: request.currency,
        timezone: request.timezone,
      },
      roles: this.generateRoles(template),
      agents: this.generateAgents(template),
      erp: {
        modules: { ...template.erp },
        currency: request.currency,
        timezone: request.timezone,
      },
      integrations: [],
    };
  }

  private generateRoles(template: Template): UniCoreConfig['roles'] {
    return ALL_ROLES.map((role) => ({
      role,
      enabled: role === 'owner' ? true : this.hasActiveAgentsOrModules(template),
    }));
  }

  private generateAgents(template: Template): UniCoreConfig['agents'] {
    // Always include the router agent
    const agents: UniCoreConfig['agents'] = [
      { type: 'router', enabled: true, autonomy: 'full_auto' },
    ];

    for (const [key, type] of Object.entries(AGENT_TYPE_MAP)) {
      const enabled = template.agents[key as keyof typeof template.agents] ?? false;
      agents.push({
        type,
        enabled,
        autonomy: enabled ? 'approval' : 'suggest',
        ...(enabled && template.channels.length > 0 && key === 'comms'
          ? { channels: template.channels }
          : {}),
      });
    }

    return agents;
  }

  private hasActiveAgentsOrModules(template: Template): boolean {
    const hasAgents = Object.values(template.agents).some((v) => v);
    const hasModules = Object.values(template.erp).some((v) => v);
    return hasAgents || hasModules;
  }
}
