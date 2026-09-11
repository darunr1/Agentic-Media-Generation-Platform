import { Badge, Card, CardContent, CardHeader, CardTitle } from "@contentforge/ui";
import { PageHeading } from "./page-heading";

interface BrandSummaryProps {
  brand: {
    name: string;
    industry: string;
    description: string;
    productsServices: string;
    targetCustomers: string;
    geographicMarket: string;
    primaryColor: string | null;
    secondaryColor: string | null;
    accentColor: string | null;
    postsPerWeekTarget: number;
    brandVoice: { toneTags: string[]; personality: string; wordsToAvoid: string[] } | null;
    guidelines: Array<{ id: string; type: string; content: string }>;
  };
}
export function BrandSummary({ brand }: BrandSummaryProps) {
  const colors = [brand.primaryColor, brand.secondaryColor, brand.accentColor].filter(
    Boolean,
  ) as string[];
  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Brand intelligence"
        title={brand.name}
        description="The structured source of truth used by every strategy, script, scene, and compliance check."
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Business profile</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <Info label="Industry" value={brand.industry} />
            <Info label="Market" value={brand.geographicMarket} />
            <Info label="Who we serve" value={brand.targetCustomers} />
            <Info label="Products & services" value={brand.productsServices} />
            <div className="sm:col-span-2">
              <Info label="Business story" value={brand.description} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Visual identity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-5 flex gap-3">
              {colors.map((color) => (
                <div
                  key={color}
                  className="size-12 rounded-xl border border-white/10 shadow-lg"
                  style={{ backgroundColor: color }}
                >
                  <span className="sr-only">{color}</span>
                </div>
              ))}
            </div>
            <p className="text-muted-foreground text-sm">
              {brand.postsPerWeekTarget} posts per week · accessible font fallbacks enabled
            </p>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Voice</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-6">{brand.brandVoice?.personality}</p>
            <div className="flex flex-wrap gap-2">
              {brand.brandVoice?.toneTags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
            <p className="text-muted-foreground text-xs">
              Blocked language: {brand.brandVoice?.wordsToAvoid.join(", ")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Compliance guardrails</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {brand.guidelines.map((item) => (
                <li key={item.id} className="border-border/60 rounded-lg border p-3">
                  <Badge variant="outline">{item.type.replaceAll("_", " ")}</Badge>
                  <p className="mt-2 text-sm">{item.content}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground mb-1 text-xs font-semibold uppercase tracking-wide">
        {label}
      </p>
      <p className="text-sm leading-6">{value}</p>
    </div>
  );
}
