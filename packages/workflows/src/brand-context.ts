import { brandContextSchema } from "@contentforge/ai";
import { prisma } from "@contentforge/database";

import { PermanentTaskError } from "./executor";

export async function buildBrandContext(workspaceId: string, brandId: string) {
  const brand = await prisma.brand.findFirst({
    where: { id: brandId, workspaceId, deletedAt: null, status: { not: "ARCHIVED" } },
    include: {
      brandVoice: true,
      guidelines: true,
      knowledgeSources: {
        where: { workspaceId, status: "READY", deletedAt: null },
        take: 10,
        include: { chunks: { orderBy: { chunkIndex: "asc" }, take: 8 } },
      },
    },
  });
  if (!brand) throw new PermanentTaskError("Brand unavailable");
  return brandContextSchema.parse({
    brandId: brand.id,
    name: brand.name,
    industry: brand.industry,
    description: brand.description,
    productsServices: brand.productsServices,
    targetCustomers: brand.targetCustomers,
    geographicMarket: brand.geographicMarket,
    voice: {
      toneTags: brand.brandVoice?.toneTags ?? [],
      personality: brand.brandVoice?.personality ?? "",
      wordsToAvoid: brand.brandVoice?.wordsToAvoid ?? [],
    },
    colors: {
      primary: brand.primaryColor,
      secondary: brand.secondaryColor,
      accent: brand.accentColor,
    },
    guidelines: brand.guidelines.map((g) => ({ type: g.type, content: g.content })),
    knowledge: brand.knowledgeSources.map((s) => ({
      sourceId: s.id,
      title: s.title,
      excerpts: s.chunks.map((c) => c.content.slice(0, 1000)),
    })),
  });
}
