import { Injectable, UnauthorizedException, Logger } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";
import { TemplatesService } from "../templates/templates.service";
import { ConfigGeneratorService } from "../config-generator/config-generator.service";
import type { UniCoreConfig } from "../config-generator/config-generator.service";
import type { ProvisionRequestDto } from "../dto/provision-request.dto";

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
  licenseKey?: string;
}

@Injectable()
export class ProvisioningService {
  private readonly logger = new Logger(ProvisioningService.name);

  constructor(
    private readonly templatesService: TemplatesService,
    private readonly configGeneratorService: ConfigGeneratorService,
  ) {}

  async provision(request: ProvisionRequestDto): Promise<ProvisioningResult> {
    const expectedSecret = process.env.BOOTSTRAP_SECRET;
    if (!expectedSecret || request.bootstrapSecret !== expectedSecret) {
      throw new UnauthorizedException("Invalid bootstrap secret");
    }

    this.logger.log(`Provisioning platform for: ${request.businessName}`);

    // Load template
    const template = this.templatesService.findById(request.template);

    // Generate config
    const config = this.configGeneratorService.generate(request, template);

    // Create admin user in API gateway database
    const apiGatewayUrl =
      process.env.API_GATEWAY_URL ?? "http://localhost:4000";
    let adminUser: { id: string; email: string; name: string; role: string };

    try {
      const registerRes = await fetch(
        `${apiGatewayUrl}/auth/provision-admin`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Bootstrap-Secret": request.bootstrapSecret,
          },
          body: JSON.stringify({
            email: request.adminEmail,
            name: request.adminName,
            password: request.adminPassword,
            role: "OWNER",
          }),
        },
      );

      if (!registerRes.ok) {
        const errBody = await registerRes.text();
        throw new Error(`API gateway responded ${registerRes.status}: ${errBody}`);
      }

      adminUser = (await registerRes.json()) as typeof adminUser;
      this.logger.log(`Admin user created in database: ${adminUser.email}`);
    } catch (err) {
      this.logger.error(
        `Failed to create admin user: ${err instanceof Error ? err.message : err}`,
      );
      // Fallback to in-memory record so provisioning still returns data
      adminUser = {
        id: uuidv4(),
        email: request.adminEmail,
        name: request.adminName,
        role: "OWNER",
      };
      this.logger.warn(
        "Admin user was NOT persisted — login will not work until the user is manually registered",
      );
    }

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

    // Auto-create community license
    let licenseKey: string | undefined;
    try {
      const licenseApiUrl =
        process.env.LICENSE_API_URL ?? "http://localhost:4600";
      const licenseAdminSecret = process.env.LICENSE_ADMIN_SECRET ?? "";
      const licenseRes = await fetch(`${licenseApiUrl}/api/v1/licenses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${licenseAdminSecret}`,
        },
        body: JSON.stringify({
          edition: "community",
          expiry: "2099-12-31T23:59:59Z",
          maxAgents: 2,
          maxRoles: 3,
        }),
      });
      if (licenseRes.ok) {
        const licenseData = (await licenseRes.json()) as {
          key?: string;
          licenseKey?: string;
        };
        licenseKey = licenseData.key ?? licenseData.licenseKey;
        this.logger.log(`Community license created: ${licenseKey}`);
      } else {
        this.logger.warn(`License creation returned ${licenseRes.status}`);
      }
    } catch (err) {
      this.logger.warn(
        `License creation failed (non-fatal): ${err instanceof Error ? err.message : err}`,
      );
    }

    // Auto-register default agents with OpenClaw gateway
    await this.registerDefaultAgents();

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
      licenseKey,
    };
  }

  private async registerDefaultAgents(): Promise<void> {
    const openclawUrl =
      process.env.OPENCLAW_GATEWAY_URL ?? "http://localhost:18790";

    const defaultAgents = [
      { agentId: "router", name: "ROUTER", type: "router", capabilities: ["routing", "delegation", "intent-classification"] },
      { agentId: "comms", name: "COMMS", type: "comms", capabilities: ["messaging", "email", "notifications"] },
      { agentId: "finance", name: "FINANCE", type: "finance", capabilities: ["invoicing", "expenses", "reports"] },
      { agentId: "growth", name: "GROWTH", type: "growth", capabilities: ["marketing", "analytics", "campaigns"] },
      { agentId: "ops", name: "OPS", type: "ops", capabilities: ["monitoring", "deployment", "system-health"] },
      { agentId: "research", name: "RESEARCH", type: "research", capabilities: ["market-research", "analysis", "trends"] },
      { agentId: "sentinel", name: "SENTINEL", type: "security", capabilities: ["security-scan", "threat-detection"] },
      { agentId: "builder", name: "BUILDER", type: "builder", capabilities: ["code-generation", "feature-building"] },
      { agentId: "erp", name: "ERP", type: "erp", capabilities: ["data-entry", "workflow-automation"] },
    ];

    let registered = 0;
    for (const agent of defaultAgents) {
      try {
        const res = await fetch(`${openclawUrl}/health/agents/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(agent),
        });
        if (res.ok) registered++;
      } catch {
        // OpenClaw may not be available during provisioning — non-fatal
      }
    }

    if (registered > 0) {
      this.logger.log(
        `Registered ${registered}/${defaultAgents.length} default agents with OpenClaw`,
      );
    } else {
      this.logger.warn(
        "Could not register any agents with OpenClaw — gateway may be unavailable",
      );
    }
  }
}
