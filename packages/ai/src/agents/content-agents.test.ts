import { describe, expect, it } from "vitest";

import { MockTextGenerationProvider } from "../providers/mock/text";
import { ProviderError } from "../providers/types";
import { brandContextSchema, type BrandContext } from "../schemas/content";

import {
  StrategyAgent,
  IdeationAgent,
  runScriptAgents,
  type AgentStepRunner,
} from "./content-agents";

const brand: BrandContext = brandContextSchema.parse({
  brandId: "test",
  name: "Riverbend Coffee",
  industry: "Coffee",
  description: "Friendly local roaster",
  productsServices: "Coffee",
  targetCustomers: "Home brewers",
  geographicMarket: "Local",
  voice: { toneTags: ["friendly"], personality: "welcoming", wordsToAvoid: [] },
  colors: { primary: null, secondary: null, accent: null },
  guidelines: [],
  knowledge: [],
});
describe("typed agent pipeline", () => {
  async function handoff() {
    const context = { provider: new MockTextGenerationProvider(), idempotencyKey: "test" };
    const strategy = await new StrategyAgent().run(
      { brand, objective: "Educate local home brewers", platforms: ["MOCK"] },
      context,
    );
    const ideas = await new IdeationAgent().run(
      { brand, strategy: strategy.data, objective: "Educate", platforms: ["MOCK"] },
      context,
    );
    return { context, idea: ideas.data[0]! };
  }
  it("passes structured strategy and ideas to writer and independent critic", async () => {
    const { context, idea } = await handoff();
    const names: string[] = [];
    const step: AgentStepRunner = (name, _schema, execute) => {
      names.push(name);
      return execute();
    };
    const result = await runScriptAgents({ brand, idea }, context, step);
    expect(result.critique.data.approved).toBe(true);
    expect(result.revisions).toBe(0);
    expect(names).toEqual(["ScriptwriterAgent", "BrandCriticAgent.0"]);
    expect(result.script.data.callToAction).toBe(idea.callToAction);
  });
  it("rejects and revises prohibited words", async () => {
    const { context, idea } = await handoff();
    idea.hook = "BAD wording";
    const result = await runScriptAgents(
      { brand: { ...brand, voice: { ...brand.voice, wordsToAvoid: ["BAD"] } }, idea },
      context,
    );
    expect(result.revisions).toBe(1);
    expect(result.script.data.openingHook).not.toContain("BAD");
    expect(result.critique.data.approved).toBe(true);
  });
  it("revises a missing disclaimer without turning CTA style guidance into copy", async () => {
    const { context, idea } = await handoff();
    const result = await runScriptAgents(
      {
        brand: {
          ...brand,
          guidelines: [
            { type: "CTA_STANDARD", content: "Invite one useful, low-pressure next action." },
            { type: "REQUIRED_DISCLAIMER", content: "Offers are subject to availability." },
          ],
        },
        idea,
      },
      context,
    );
    expect(result.revisions).toBe(1);
    expect(result.critique.data.approved).toBe(true);
    expect(result.script.data.caption).toContain("Offers are subject to availability.");
    expect(
      result.script.data.platformVariants.every((v) =>
        v.caption.includes("Offers are subject to availability."),
      ),
    ).toBe(true);
    expect(result.script.data.callToAction).toBe(idea.callToAction);
  });
  it("cannot exceed two revisions when the constraints conflict", async () => {
    const { context, idea } = await handoff();
    idea.callToAction = "BAD";
    const names: string[] = [];
    const step: AgentStepRunner = (name, _schema, execute) => {
      names.push(name);
      return execute();
    };
    const result = await runScriptAgents(
      { brand: { ...brand, voice: { ...brand.voice, wordsToAvoid: ["BAD"] } }, idea },
      context,
      step,
    );
    expect(result.revisions).toBe(2);
    expect(result.critique.data.approved).toBe(false);
    expect(names.filter((n) => n.startsWith("RevisionAgent"))).toHaveLength(2);
  });
  it("rejects an invalid structured handoff before calling the provider", async () => {
    const { context, idea } = await handoff();
    await expect(
      runScriptAgents({ brand, idea: { ...idea, title: "" } }, context),
    ).rejects.toThrow();
  });
  it("propagates provider failure without replacing it with mock output", async () => {
    const { context, idea } = await handoff();
    context.provider.generate = async () => {
      throw new ProviderError("unavailable", "UNAVAILABLE", true, "mock");
    };
    await expect(runScriptAgents({ brand, idea }, context)).rejects.toThrow("unavailable");
  });
});
