"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ScriptOutput } from "@contentforge/ai";
import { Button, Input, Textarea } from "@contentforge/ui";
import { mutate } from "./workflow-actions";

export function ScriptEditor({
  initial,
  workspaceSlug,
  contentId,
}: {
  initial: ScriptOutput;
  workspaceSlug: string;
  contentId: string;
}) {
  const [script, setScript] = useState(initial),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const router = useRouter();
  const update = (field: keyof ScriptOutput, value: unknown) =>
    setScript((previous) => ({ ...previous, [field]: value }));
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMessage("");
        try {
          await mutate(`/api/v1/workspaces/${workspaceSlug}/content/${contentId}`, "PATCH", script);
          setMessage("Saved. Run review and rendering again before approval.");
          router.refresh();
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "Save failed");
        } finally {
          setBusy(false);
        }
      }}
    >
      {(
        [
          ["openingHook", "Opening hook"],
          ["spokenNarration", "Narration"],
          ["callToAction", "Call to action"],
          ["caption", "Caption / platform copy"],
        ] as const
      ).map(([key, label]) => (
        <label key={key} className="block space-y-1 text-sm">
          <span>{label}</span>
          <Textarea
            required
            value={script[key]}
            onChange={(e) => update(key, e.target.value)}
            maxLength={5000}
          />
        </label>
      ))}
      <p className="text-muted-foreground text-xs">
        Scene narration controls burned captions. The mock audio is a reference tone.
      </p>
      {script.scenes.map((scene, i) => (
        <fieldset key={scene.sequenceNumber} className="space-y-2 rounded-xl border p-4">
          <legend className="px-2 text-sm">
            Scene {scene.sequenceNumber} · {scene.startSeconds}–{scene.endSeconds}s
          </legend>
          {(
            [
              ["onScreenText", "Scene text"],
              ["narration", "Scene narration / captions"],
              ["visualPrompt", "Visual prompt"],
            ] as const
          ).map(([key, label]) => (
            <label className="block text-sm" key={key}>
              {label}
              <Textarea
                value={scene[key]}
                onChange={(e) =>
                  update(
                    "scenes",
                    script.scenes.map((s, n) => (n === i ? { ...s, [key]: e.target.value } : s)),
                  )
                }
                maxLength={2000}
              />
            </label>
          ))}
        </fieldset>
      ))}
      {script.platformVariants.map((variant, i) => (
        <label key={i} className="block text-sm">
          {variant.platform} copy
          <Input
            value={variant.caption}
            maxLength={2200}
            onChange={(e) =>
              update(
                "platformVariants",
                script.platformVariants.map((v, n) =>
                  n === i ? { ...v, caption: e.target.value } : v,
                ),
              )
            }
          />
        </label>
      ))}
      <Button disabled={busy}>{busy ? "Saving…" : "Save script changes"}</Button>
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </form>
  );
}
