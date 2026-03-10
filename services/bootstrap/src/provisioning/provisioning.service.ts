import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { TemplatesService } from '../templates/templates.service';
import { ConfigGeneratorService } from '../config-generator/config-generator.service';
import type { UniCoreConfig } from '../config-generator/config-generator.service';
import type { ProvisionRequestDto } from '../dto/provision-request.dto';

export interface ProvisioningResult {
  success: boolean;
  config: UniCoreConfig;
  admin: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  summary: {
    template: string;
    businessName: string;
    erpModulesEnabled: string[];
    agentsEnabled: string[];
    rolesEnabled: string[];
  };
}

@Injectable()
export class ProvisioningService {
  private readonly logger = new Logger(ProvisioningService.name);

  constructor(
    private readonly templatesService: TemplatesService,
    private readonly configGeneratorService: ConfigGeneratorService,
  ) {}

  provision(request: ProvisionRequestDto): ProvisioningResult {
    const expectedSecret = process.env.BOOTSTRAP_SECRET;
    if (!expectedSecret || request.bootstrapSecret !== expectedSecret) {
      throw new UnauthorizedException('Invalid bootstrap secret');
    }

    this.logger.log(`Provisioning platform for: ${request.businessName}`);

    // Load template
    const template = this.templatesService.findById(request.template);

    // Generate config
    const config = this.configGeneratorService.generate(request, template);

    // Create admin user record
    const adminUser = {
      id: uuidv4(),
      email: request.adminEmail,
      name: request.adminName,
      role: 'owner',
    };

    // Build summary
    const erpModulesEnabled = Object.entries(template.erp)
      .filter(([, enabled]) => enabled)
      .map(([module]) => module);

    const agentsEnabled = Object.entries(template.agents)
      .filter(([, enabled]) => enabled)
      .map(([agent]) => agent);

    const rolesEnabled = config.roles
      .filter((r) => r.enabled)
      .map((r) => r.role);

    this.logger.log(
      `Provisioning complete: ${erpModulesEnabled.length} ERP modules, ${agentsEnabled.length} agents, ${rolesEnabled.length} roles`,
    );

    return {
      success: true,
      config,
      admin: adminUser,
      summary: {
        template: request.template,
        businessName: request.businessName,
        erpModulesEnabled,
        agentsEnabled,
        rolesEnabled,
      },
    };
  }
}
