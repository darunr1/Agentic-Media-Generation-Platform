import { prisma } from "@contentforge/database";
import { brandContextSchema, type BrandContext } from "@contentforge/ai";
import { NotFoundError } from "@contentforge/shared";

export async function buildBrandContext(
  workspaceId: string,
  brandId: string,
): Promise<BrandContext> {
  const brand = await prisma.brand.findFirst({
    where: { id: brandId, workspaceId, deletedAt: null },
    include: {
      brandVoice: true,
      guidelines: true,
      knowledgeSources: {
        where: { status: "READY", deletedAt: null },
        include: { chunks: { orderBy: { chunkIndex: "asc" }, take: 8 } },
      },
    },
  });
  if (!brand) throw new NotFoundError("Brand", brandId);
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
    guidelines: brand.guidelines.map((item) => ({ type: item.type, content: item.content })),
    knowledge: brand.knowledgeSources.map((source) => ({
      sourceId: source.id,
      title: source.title,
      excerpts: source.chunks.map((chunk) => chunk.content),
    })),
  });
}
