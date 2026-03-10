import { Test, TestingModule } from "@nestjs/testing";
import { ErpAgent } from "./erp.agent";
import { AgentContext, AgentMessage } from "../../interfaces/agent-base.interface";

function makeMessage(content = "Show all unpaid invoices"): AgentMessage {
  return { id: "msg-erp-1", from: "user-1", to: "erp", content, sessionId: "sess-erp", timestamp: new Date().toISOString() };
}
function makeContext(overrides: Partial<AgentContext> = {}): AgentContext {
  return { sessionId: "sess-erp", history: [], businessContext: { businessName: "ACME Corp", erpModules: ["contacts", "orders", "invoices"] }, ...overrides };
}

describe("ErpAgent", () => {
  let agent: ErpAgent;
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({ providers: [ErpAgent] }).compile();
    agent = module.get<ErpAgent>(ErpAgent);
  });

  it("should be defined", () => { expect(agent).toBeDefined(); });
  it("should have agentType erp", () => { expect(agent.agentType).toBe("erp"); });

  describe("getToolDefinitions()", () => {
    it("should expose all 7 expected tools", () => {
      const names = agent.getToolDefinitions().map((t) => t.name);
      expect(names).toContain("nl_query");
      expect(names).toContain("create_record");
      expect(names).toContain("update_record");
      expect(names).toContain("delete_record");
      expect(names).toContain("bulk_update");
      expect(names).toContain("export_data");
      expect(names).toContain("generate_summary");
    });
    it("delete_record should require reason for auditing", () => {
      const tool = agent.getToolDefinitions().find((t) => t.name === "delete_record");
      expect(tool?.parameters.required).toContain("reason");
    });
    it("nl_query should require module and naturalLanguageQuery", () => {
      const tool = agent.getToolDefinitions().find((t) => t.name === "nl_query");
      expect(tool?.parameters.required).toContain("module");
      expect(tool?.parameters.required).toContain("naturalLanguageQuery");
    });
  });

  describe("handle()", () => {
    it("should return a done AgentResponse", async () => {
      const res = await agent.handle(makeMessage(), makeContext());
      expect(res.done).toBe(true);
      expect(res.agentType).toBe("erp");
    });
    it("should work with default erpModules when not set", async () => {
      const res = await agent.handle(makeMessage(), makeContext({ businessContext: { businessName: "Test" } }));
      expect(res.done).toBe(true);
    });
  });
});
