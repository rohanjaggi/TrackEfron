"use client";

import { useEffect, useState } from "react";
import { Key } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { PasswordInput } from "@/components/ui/input";
import { LoadingLine } from "@/components/ui/loading";
import { Field, Notice, SectionHeader } from "@/components/ui/page";
import { useToast } from "@/components/ui/toast";
import { TRY_AGAIN } from "@/lib/profile-errors";

type AiKeyInfo = {
  hasKey: boolean;
  provider: string | null;
  maskedKey: string | null;
  source: string;
};

const providerLabel = (provider: string | null) =>
  provider === "anthropic"
    ? "Anthropic"
    : provider === "openai"
      ? "OpenAI"
      : provider === "gemini"
        ? "Gemini"
        : null;

export function AiSettingsSection() {
  const toast = useToast();
  // AI key
  const [aiKeyInput, setAiKeyInput] = useState("");
  const [aiKeyInfo, setAiKeyInfo] = useState<AiKeyInfo | null>(null);
  const [aiKeyLoading, setAiKeyLoading] = useState(true);
  const [aiKeyLoadError, setAiKeyLoadError] = useState(false);
  const [aiKeySaving, setAiKeySaving] = useState(false);
  const [aiKeyError, setAiKeyError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/ai/settings")
      .then((r) => {
        if (!r.ok) throw new Error("AI settings request failed");
        return r.json() as Promise<AiKeyInfo>;
      })
      .then(setAiKeyInfo)
      .catch(() => setAiKeyLoadError(true))
      .finally(() => setAiKeyLoading(false));
  }, []);

  const handleSaveAiKey = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!aiKeyInput || aiKeySaving) return;
    setAiKeySaving(true);
    setAiKeyError(null);
    try {
      const res = await fetch("/api/ai/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: aiKeyInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        // 400s carry a plain-language reason about the key itself; anything else is ours.
        setAiKeyError(
          res.status === 400 && typeof data?.error === "string"
            ? data.error
            : `Couldn't save your API key. ${TRY_AGAIN}`
        );
        return;
      }
      setAiKeyInfo(data);
      setAiKeyInput("");
      toast({ mark: "Saved", title: "API key saved" });
    } catch {
      setAiKeyError(`Couldn't save your API key. ${TRY_AGAIN}`);
    } finally {
      setAiKeySaving(false);
    }
  };

  const handleRemoveAiKey = async () => {
    setAiKeyError(null);
    try {
      const res = await fetch("/api/ai/settings", { method: "DELETE" });
      if (!res.ok) throw new Error("AI key removal failed");
      const data = await res.json();
      setAiKeyInfo(data);
      toast({ mark: "Removed", tone: "info", title: "API key removed" });
    } catch {
      setAiKeyError(`Couldn't remove your API key. ${TRY_AGAIN}`);
    }
  };

  const detectedProvider = aiKeyInput.startsWith("sk-ant-")
    ? "Anthropic"
    : aiKeyInput.startsWith("AIza")
      ? "Gemini"
      : aiKeyInput.startsWith("sk-")
        ? "OpenAI"
        : null;

  const aiProvider = providerLabel(aiKeyInfo?.provider ?? null);
  const usesServerKey = aiKeyInfo?.source === "env";

  return (
    <section>
      <SectionHeader title="AI settings" />

      <div className="frame p-5">
        {aiKeyLoading ? (
          <LoadingLine label="Loading AI settings" />
        ) : aiKeyLoadError || !aiKeyInfo ? (
          <Notice tone="error" title="Couldn't load your AI settings">
            Reload the page to try again.
          </Notice>
        ) : aiKeyInfo.hasKey && aiKeyInfo.source !== "env" ? (
          <div className="flex flex-col gap-4">
            {aiKeyError && <Notice tone="error">{aiKeyError}</Notice>}
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
              <div className="flex min-w-0 flex-1 basis-64 items-start gap-4">
                <Key aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-success" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <p className="break-all text-[13px] font-medium text-foreground">
                      {aiKeyInfo.maskedKey ?? "Key saved"}
                    </p>
                    {aiProvider && <Badge>{aiProvider}</Badge>}
                  </div>
                  <p className="t-meta mt-1.5">
                    Powers Taste DNA, recommendations, and vibe search
                  </p>
                </div>
              </div>
              <ConfirmButton
                label="Remove key"
                confirmLabel="Confirm remove"
                onConfirm={handleRemoveAiKey}
              />
            </div>
          </div>
        ) : (
          <form onSubmit={handleSaveAiKey} className="flex max-w-xl flex-col gap-4">
            {aiKeyError && <Notice tone="error">{aiKeyError}</Notice>}
            <div className="flex items-start gap-4">
              <Key aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="t-card">{usesServerKey ? "Server key in use" : "No API key"}</p>
                <p className="t-meta mt-1.5">
                  {usesServerKey
                    ? `The server's ${aiProvider ?? "AI"} key is used until you add your own.`
                    : "Add an Anthropic, OpenAI or Gemini key to enable AI-powered features"}
                </p>
              </div>
            </div>
            <Field
              label="API key"
              htmlFor="ai-api-key"
              hint={
                detectedProvider
                  ? `Looks like a ${detectedProvider} key.`
                  : "Your key is stored with your account and is only ever shown masked."
              }
            >
              <div className="flex flex-wrap gap-2">
                <PasswordInput
                  id="ai-api-key"
                  noun="API key"
                  wrapperClassName="min-w-0 flex-1 basis-56"
                  value={aiKeyInput}
                  onChange={(e) => {
                    setAiKeyInput(e.target.value);
                    setAiKeyError(null);
                  }}
                  placeholder="sk-ant-... / sk-... / AIza..."
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                />
                <Button
                  type="submit"
                  variant="outline"
                  className="h-10"
                  disabled={aiKeySaving || !aiKeyInput}
                >
                  {aiKeySaving ? "Saving…" : "Save key"}
                </Button>
              </div>
            </Field>
          </form>
        )}
      </div>
    </section>
  );
}
