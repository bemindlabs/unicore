import { Test, TestingModule } from "@nestjs/testing";
import { BuilderAgent } from "./builder.agent";
import { AgentContext, AgentMessage } from "../../interfaces/agent-base.interface";

function makeMessage(content = "Generate a TypeScript service for user notifications"): AgentMessage {
  return { id: "msg-builder-1", from: "user-1", to: "builder", content, sessionId: "sess-builder", timestamp: new Date().toISOString() };
}
function makeContext(overrides: Partial<AgentContext> = {}): AgentContext {
  return { sessionId: "sess-builder", history: [], businessContext: { businessName: "ACME Corp" }, ...overrides };
}

describe("BuilderAgent", () => {
  let agent: BuilderAgent;
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({ providers: [BuilderAgent] }).compile();
    agent = module.get<BuilderAgent>(BuilderAgent);
  });

  it("should be defined", () => { expect(agent).toBeDefined(); });
  it("should have agentType builder", () => { expect(agent.agentType).toBe("builder"); });

  describe("getToolDefinitions()", () => {
    it("should expose all 7 expected tools", () => {
      const names = agent.getToolDefinitions().map((t) => t.name);
      expect(names).toContain("generate_code");
      expect(names).toContain("create_workflow");
      expect(names).toContain("scaffold_api");
      expect(names).toContain("write_tests");
      expect(names).toContain("review_code");
      expect(names).toContain("create_webhook");
      expect(names).toContain("deploy_function");
    });
    it("generate_code should require description and language", () => {
      const tool = agent.getToolDefinitions().find((t) => t.name === "generate_code");
      expect(tool?.parameters.required).toContain("description");
      expect(tool?.parameters.required).toContain("language");
    });
    it("deploy_function should require functionName, runtime, sourceCode", () => {
      const tool = agent.getToolDefinitions().find((t) => t.name === "deploy_function");
      expect(tool?.parameters.required).toContain("functionName");
      expect(tool?.parameters.required).toContain("runtime");
      expect(tool?.parameters.required).toContain("sourceCode");
    });
  });

  describe("handle()", () => {
    it("should return a done AgentResponse", async () => {
      const res = await agent.handle(makeMessage(), makeContext());
      expect(res.done).toBe(true);
      expect(res.agentType).toBe("builder");
    });
    it("should include available tools in data payload", async () => {
      const res = await agent.handle(makeMessage(), makeContext());
      const tools = res.data?.["availableTools"] as Array<{ name: string }>;
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.some((t) => t.name === "generate_code")).toBe(true);
    });
    it("should work without businessContext", async () => {
      await expect(agent.handle(makeMessage(), makeContext({ businessContext: undefined }))).resolves.toBeDefined();
    });
  });
});
