import { Badge } from "@contentforge/ui";
export function ContentPreview({ title, caption }: { title: string; caption: string }) {
  return (
    <div className="relative mx-auto aspect-[9/16] max-h-[540px] overflow-hidden rounded-[2rem] border border-white/10 bg-[#0b1020] shadow-2xl">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(124,58,237,.55),transparent_35%),radial-gradient(circle_at_85%_70%,rgba(34,211,238,.35),transparent_35%)]" />
      <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.05)_1px,transparent_1px)] [background-size:32px_32px]" />
      <div className="relative flex h-full flex-col justify-between p-7">
        <div className="flex items-center justify-between">
          <Badge className="bg-white/10 text-white">Riverbend</Badge>
          <span className="text-xs text-white/60">00:24</span>
        </div>
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[.2em] text-cyan-300">
            A three-step guide
          </p>
          <h2 className="text-3xl font-bold leading-tight text-white">{title}</h2>
        </div>
        <div className="rounded-2xl bg-black/45 p-4 backdrop-blur">
          <p className="text-sm leading-6 text-white">{caption}</p>
          <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/15">
            <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-violet-400 to-cyan-300" />
          </div>
        </div>
      </div>
    </div>
  );
}
