import { Badge, Card, CardContent } from "@contentforge/ui";
import { StatusDot } from "./status-dot";
const platforms = [
  {
    name: "Mock Publisher",
    status: "Connected",
    active: true,
    detail: "Publishing, scheduling & analytics",
  },
  { name: "Instagram", status: "Setup required", detail: "Official OAuth scaffold ready" },
  { name: "YouTube", status: "Setup required", detail: "Official OAuth scaffold ready" },
  { name: "Facebook", status: "Setup required", detail: "Typed adapter available" },
  { name: "Threads", status: "Setup required", detail: "Typed adapter available" },
  { name: "TikTok", status: "Setup required", detail: "Typed adapter available" },
  { name: "X", status: "Setup required", detail: "Typed adapter available" },
];
export function PlatformGrid() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {platforms.map((platform) => (
        <Card key={platform.name} className="hover:border-primary/40 transition-colors">
          <CardContent className="flex items-start justify-between p-5">
            <div>
              <div className="flex items-center gap-2">
                <StatusDot active={platform.active} />
                <h3 className="font-medium">{platform.name}</h3>
              </div>
              <p className="text-muted-foreground mt-2 text-sm">{platform.detail}</p>
            </div>
            <Badge variant={platform.active ? "success" : "warning"}>{platform.status}</Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
