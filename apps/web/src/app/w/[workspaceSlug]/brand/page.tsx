import { notFound } from "next/navigation";
import { prisma } from "@contentforge/database";
import { hasPermission } from "@contentforge/auth";
import { BrandSummary } from "@/components/product/brand-summary";
import { RecordForm, ActionButton } from "@/components/product/workflow-actions";
import { getWorkspaceContext } from "@/server/services/workspace-context";
const fields = [
  { name: "name", label: "Brand name" },
  { name: "industry", label: "Industry" },
  { name: "description", label: "Description", type: "textarea" },
  { name: "productsServices", label: "Products and services", type: "textarea" },
  { name: "targetCustomers", label: "Target customers", type: "textarea" },
  { name: "geographicMarket", label: "Geographic market" },
  { name: "toneTags", label: "Tone tags (comma separated)", required: false },
  { name: "personality", label: "Voice personality", required: false },
  { name: "wordsToAvoid", label: "Words to avoid (comma separated)", required: false },
  {
    name: "guidelines",
    label: "Guidelines (TYPE|text, one per line)",
    type: "textarea",
    required: false,
  },
];
export default async function BrandPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const ctx = await getWorkspaceContext(workspaceSlug);
  if (!ctx) notFound();
  const brands = await prisma.brand.findMany({
    where: { workspaceId: ctx.workspace.id, deletedAt: null },
    include: { brandVoice: true, guidelines: true },
  });
  const canWrite = hasPermission(ctx.role, "brand:write");
  return (
    <div className="space-y-6">
      {brands.map((brand) => (
        <section className="space-y-4" key={brand.id}>
          <BrandSummary brand={brand} />
          {canWrite && (
            <details>
              <summary className="cursor-pointer font-medium">Edit brand profile</summary>
              <RecordForm
                url={`/api/v1/workspaces/${workspaceSlug}/brands/${brand.id}`}
                method="PATCH"
                fields={fields}
                arrays={["toneTags", "wordsToAvoid"]}
                initial={{
                  name: brand.name,
                  industry: brand.industry,
                  description: brand.description,
                  productsServices: brand.productsServices,
                  targetCustomers: brand.targetCustomers,
                  geographicMarket: brand.geographicMarket,
                  toneTags: brand.brandVoice?.toneTags.join(", ") ?? "",
                  personality: brand.brandVoice?.personality ?? "",
                  wordsToAvoid: brand.brandVoice?.wordsToAvoid.join(", ") ?? "",
                  guidelines: brand.guidelines.map((g) => `${g.type}|${g.content}`).join("\n"),
                }}
                label="Save brand profile"
              />
              <div className="mt-4">
                <ActionButton
                  url={`/api/v1/workspaces/${workspaceSlug}/brands/${brand.id}`}
                  method="DELETE"
                >
                  Archive brand
                </ActionButton>
              </div>
            </details>
          )}
        </section>
      ))}
      {canWrite && (
        <details open={!brands.length}>
          <summary className="cursor-pointer font-medium">Create brand profile</summary>
          <RecordForm
            url={`/api/v1/workspaces/${workspaceSlug}/brands`}
            fields={fields}
            arrays={["toneTags", "wordsToAvoid"]}
            label="Create brand"
          />
        </details>
      )}
    </div>
  );
}
