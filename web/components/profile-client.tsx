"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Camera, Disc3, Eye, EyeOff, Key, Unplug } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Input } from "@/components/ui/input";
import { LoadingLine } from "@/components/ui/loading";
import {
  Avatar,
  Field,
  Notice,
  PageHeader,
  SectionHeader,
  StatBlock,
} from "@/components/ui/page";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { syncProfile } from "@/lib/sync-profile";
import { TasteDNACard } from "@/components/taste-dna-card";

interface ProfileProps {
  profile: {
    id: string;
    email: string;
    fullName: string;
    username: string;
    avatarUrl: string;
    profileColor: string;
    createdAt: string;
    spotifyConnected: boolean;
  };
}

type WatchLog = {
  rating: number;
  review: string | null;
  media_type: "movie" | "tv";
  created_at: string;
};

type AiKeyInfo = {
  hasKey: boolean;
  provider: string | null;
  maskedKey: string | null;
  source: string;
};

const TRY_AGAIN = "Check your connection and try again.";

const formatMonthYear = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

const providerLabel = (provider: string | null) =>
  provider === "anthropic"
    ? "Anthropic"
    : provider === "openai"
      ? "OpenAI"
      : provider === "gemini"
        ? "Gemini"
        : null;

/** Average mid-tone colour of an image as a hex string, or "" when none can be read. */
function extractDominantColor(file: File): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 50 / Math.max(img.width, img.height));
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(img.src);
        resolve("");
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

      let r = 0, g = 0, b = 0, count = 0;
      for (let i = 0; i < imageData.length; i += 4) {
        const pr = imageData[i], pg = imageData[i + 1], pb = imageData[i + 2];
        const brightness = (pr + pg + pb) / 3;
        if (brightness > 30 && brightness < 230) {
          r += pr; g += pg; b += pb; count++;
        }
      }

      if (count === 0) {
        // No usable mid-tones: store no colour and let the page fall back to the accent.
        resolve("");
      } else {
        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);
        resolve(`#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`);
      }
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      resolve("");
    };
    img.src = URL.createObjectURL(file);
  });
}

export function ProfileClient({ profile }: ProfileProps) {
  const searchParams = useSearchParams();
  const toast = useToast();

  // Profile details
  const [saved, setSaved] = useState({ fullName: profile.fullName, username: profile.username });
  const [fullName, setFullName] = useState(profile.fullName);
  const [username, setUsername] = useState(profile.username);
  const [nameError, setNameError] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  // Photo
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl);
  const [profileColor, setProfileColor] = useState(profile.profileColor);
  const [isUploading, setIsUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stats
  const [watchLogs, setWatchLogs] = useState<WatchLog[]>([]);
  const [watchlistCount, setWatchlistCount] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(false);

  // Spotify
  const [spotifyConnected, setSpotifyConnected] = useState(profile.spotifyConnected);
  const spotifyStatus = searchParams.get("spotify");

  // AI key
  const [aiKeyInput, setAiKeyInput] = useState("");
  const [showAiKey, setShowAiKey] = useState(false);
  const [aiKeyInfo, setAiKeyInfo] = useState<AiKeyInfo | null>(null);
  const [aiKeyLoading, setAiKeyLoading] = useState(true);
  const [aiKeyLoadError, setAiKeyLoadError] = useState(false);
  const [aiKeySaving, setAiKeySaving] = useState(false);
  const [aiKeyError, setAiKeyError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const supabase = createClient();
        const [logsRes, watchlistRes] = await Promise.all([
          supabase.from("watch_logs").select("rating, review, media_type, created_at"),
          supabase.from("watchlist").select("id", { count: "exact", head: true }),
        ]);
        if (logsRes.error || watchlistRes.error) {
          setStatsError(true);
          return;
        }
        setWatchLogs(logsRes.data || []);
        setWatchlistCount(watchlistRes.count || 0);
      } catch {
        setStatsError(true);
      } finally {
        setStatsLoading(false);
      }
    }
    fetchStats();
  }, []);

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
      setShowAiKey(false);
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

  const stats = {
    watched: watchLogs.length,
    movies: watchLogs.filter((i) => i.media_type === "movie").length,
    tvShows: watchLogs.filter((i) => i.media_type === "tv").length,
    reviews: watchLogs.filter((i) => i.review && i.review.trim().length > 0).length,
    avgRating: watchLogs.length > 0
      ? (watchLogs.reduce((acc, i) => acc + Number(i.rating), 0) / watchLogs.length).toFixed(1)
      : "—",
    watchlist: watchlistCount,
  };

  const handleSpotifyDisconnect = async () => {
    try {
      const res = await fetch("/api/spotify/disconnect", { method: "POST" });
      if (!res.ok) throw new Error("Spotify disconnect failed");
      setSpotifyConnected(false);
      toast({ mark: "Disconnected", tone: "info", title: "Spotify disconnected" });
    } catch {
      toast({
        mark: "Failed",
        tone: "error",
        title: "Couldn't disconnect Spotify",
        description: TRY_AGAIN,
      });
    }
  };

  const isDirty = fullName !== saved.fullName || username !== saved.username;

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSaving) return;
    setSaveError(false);

    const nextNameError = !fullName.trim() ? "Name cannot be empty" : null;
    const nextUsernameError =
      !username.trim() || username.length < 3
        ? "Username must be at least 3 characters"
        : !/^[a-z0-9_]+$/.test(username)
          ? "Username can only contain lowercase letters, numbers, and underscores"
          : null;
    setNameError(nextNameError);
    setUsernameError(nextUsernameError);
    if (nextNameError || nextUsernameError) return;

    setIsSaving(true);
    try {
      const supabase = createClient();
      const nextFullName = fullName.trim();
      const nextUsername = username.toLowerCase().trim();
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: nextFullName,
          username: nextUsername,
        },
      });

      if (error) throw error;

      // Keep profiles table in sync
      await syncProfile(supabase);

      setFullName(nextFullName);
      setUsername(nextUsername);
      setSaved({ fullName: nextFullName, username: nextUsername });
      toast({ mark: "Saved", title: "Profile updated" });
    } catch (err: unknown) {
      console.error("Profile save failed:", err);
      setSaveError(true);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = () => {
    setFullName(saved.fullName);
    setUsername(saved.username);
    setNameError(null);
    setUsernameError(null);
    setSaveError(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX_SIZE = 2 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setAvatarError("Image must be under 2MB");
      e.target.value = "";
      return;
    }
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setAvatarError("Only PNG, JPEG, and WebP images are allowed");
      e.target.value = "";
      return;
    }

    setIsUploading(true);
    setAvatarError(null);

    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop();
      const filePath = `${profile.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const dominantColor = await extractDominantColor(file);

      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          avatar_url: publicUrl,
          profile_color: dominantColor || null,
        },
      });

      if (updateError) throw updateError;

      // Keep profiles table in sync
      await syncProfile(supabase);

      setAvatarUrl(`${publicUrl}?t=${Date.now()}`);
      setProfileColor(dominantColor);
      toast({ mark: "Updated", title: "Profile photo updated" });
    } catch (err: unknown) {
      console.error("Avatar upload failed:", err);
      setAvatarError(`Couldn't upload that photo. ${TRY_AGAIN}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const memberSince = formatMonthYear(profile.createdAt);
  // The colour read from the user's own photo; the first chart colour stands in until there is one.
  const tint = profileColor || "var(--chart-1)";
  const aiProvider = providerLabel(aiKeyInfo?.provider ?? null);

  return (
    <div className="flex flex-col gap-16">
      {/* Header */}
      <div className="relative isolate">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -top-10 -z-10 h-48"
          style={{
            background: `radial-gradient(ellipse 70% 100% at 20% 0%, color-mix(in srgb, ${tint} 24%, transparent), transparent 75%)`,
          }}
        />
        <div className="flex flex-wrap items-center gap-x-6 gap-y-5">
          <Avatar
            src={avatarUrl || null}
            name={saved.fullName || profile.email}
            size={96}
          />
          <PageHeader
            className="mb-0 min-w-0 flex-1 basis-64"
            title={saved.fullName ? <strong>{saved.fullName}</strong> : "Set your name"}
            description={
              <>
                @{saved.username || "username"}
                <span aria-hidden="true"> · </span>
                Member since {memberSince}
              </>
            }
            actions={
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  aria-label="Choose a profile photo"
                  tabIndex={-1}
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  <Camera aria-hidden="true" />
                  {isUploading ? "Uploading…" : avatarUrl ? "Change photo" : "Upload photo"}
                </Button>
              </>
            }
          />
        </div>
        {avatarError && (
          <Notice tone="error" title="Photo not updated" className="mt-5 max-w-xl">
            {avatarError}
          </Notice>
        )}
      </div>

      {/* Stats */}
      <section aria-label="Your figures">
        {statsError ? (
          <Notice tone="error" title="Couldn't load your figures">
            Reload the page to try again.
          </Notice>
        ) : (
          <div className="flex flex-wrap gap-x-12 gap-y-6">
            <StatBlock label="Watched" value={stats.watched} loading={statsLoading} />
            <StatBlock label={stats.movies === 1 ? "Film" : "Films"} value={stats.movies} loading={statsLoading} />
            <StatBlock label={stats.tvShows === 1 ? "TV show" : "TV shows"} value={stats.tvShows} loading={statsLoading} />
            <StatBlock label={stats.reviews === 1 ? "Review" : "Reviews"} value={stats.reviews} loading={statsLoading} />
            <StatBlock label="Avg rating" value={stats.avgRating} loading={statsLoading} />
            <StatBlock label="Watchlist" value={stats.watchlist} loading={statsLoading} />
          </div>
        )}
      </section>

      {/* Taste DNA */}
      <TasteDNACard />

      {/* Profile details */}
      <section>
        <SectionHeader title="Profile details" />
        <form onSubmit={handleSave} noValidate className="flex max-w-xl flex-col gap-6">
          {saveError && (
            <Notice tone="error" title="Couldn't save your profile">
              {TRY_AGAIN} Your changes are still here.
            </Notice>
          )}

          <Field label="Full name" htmlFor="fullName" error={nameError}>
            <Input
              id="fullName"
              autoComplete="name"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                setNameError(null);
              }}
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? "fullName-error" : undefined}
            />
          </Field>

          <Field
            label="Username"
            htmlFor="username"
            hint="Lowercase letters, numbers, and underscores only"
            error={usernameError}
          >
            <Input
              id="username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={username}
              onChange={(e) => {
                setUsername(e.target.value.toLowerCase());
                setUsernameError(null);
              }}
              aria-invalid={usernameError ? true : undefined}
              aria-describedby={usernameError ? "username-error" : "username-hint"}
            />
          </Field>

          <Field label="Email" htmlFor="email" hint="Email cannot be changed">
            <Input
              id="email"
              type="email"
              value={profile.email}
              readOnly
              aria-describedby="email-hint"
              className="text-muted-foreground"
            />
          </Field>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button type="submit" disabled={isSaving || !isDirty}>
              {isSaving ? "Saving…" : "Save changes"}
            </Button>
            {isDirty && (
              <Button variant="ghost" onClick={handleDiscard} disabled={isSaving}>
                Discard changes
              </Button>
            )}
          </div>
        </form>
      </section>

      {/* Connected services */}
      <section>
        <SectionHeader title="Connected services" />

        {spotifyStatus === "connected" && (
          <Notice tone="success" className="mb-4">
            Spotify connected.
          </Notice>
        )}
        {spotifyStatus === "denied" && (
          <Notice tone="warning" className="mb-4">
            Spotify connection was denied.
          </Notice>
        )}
        {spotifyStatus === "error" && (
          <Notice tone="error" className="mb-4">
            Something went wrong connecting to Spotify. Please try again.
          </Notice>
        )}

        <div className="frame flex flex-wrap items-center justify-between gap-x-6 gap-y-4 p-5">
          <div className="flex min-w-0 flex-1 basis-64 items-start gap-4">
            <Disc3 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <p className="t-card">Spotify</p>
                {spotifyConnected ? (
                  <Badge variant="success">Connected</Badge>
                ) : (
                  <Badge variant="outline">Not connected</Badge>
                )}
              </div>
              <p className="t-meta mt-1.5">
                {spotifyConnected
                  ? "Enables personalised music recommendations"
                  : "Connect to unlock personalised music recommendations"}
              </p>
            </div>
          </div>

          {spotifyConnected ? (
            <ConfirmButton
              label="Disconnect"
              confirmLabel="Confirm disconnect"
              icon={Unplug}
              onConfirm={handleSpotifyDisconnect}
            />
          ) : (
            <Button
              asChild
              className="border-[#1DB954] bg-[#1DB954] text-black hover:border-foreground hover:bg-foreground"
            >
              <a href="/api/spotify/connect">Connect Spotify</a>
            </Button>
          )}
        </div>
      </section>

      {/* AI settings */}
      <section>
        <SectionHeader title="AI settings" />

        <div className="frame p-5">
          {aiKeyLoading ? (
            <LoadingLine label="Loading AI settings" />
          ) : aiKeyLoadError || !aiKeyInfo ? (
            <Notice tone="error" title="Couldn't load your AI settings">
              Reload the page to try again.
            </Notice>
          ) : aiKeyInfo.source === "env" ? (
            <div className="flex items-start gap-4">
              <Key aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <p className="t-card">Server configured</p>
                  {aiProvider && <Badge>{aiProvider}</Badge>}
                </div>
                <p className="t-meta mt-1.5">AI features are configured by the server</p>
              </div>
            </div>
          ) : aiKeyInfo.hasKey ? (
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
                  <p className="t-card">No API key</p>
                  <p className="t-meta mt-1.5">
                    Add an Anthropic, OpenAI or Gemini key to enable AI-powered features
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
                  <div className="relative min-w-0 flex-1 basis-56">
                    <Input
                      id="ai-api-key"
                      type={showAiKey ? "text" : "password"}
                      value={aiKeyInput}
                      onChange={(e) => {
                        setAiKeyInput(e.target.value);
                        setAiKeyError(null);
                      }}
                      placeholder="sk-ant-... / sk-... / AIza..."
                      autoComplete="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      aria-describedby="ai-api-key-hint"
                      className="pr-11"
                    />
                    <button
                      type="button"
                      aria-label="Show API key"
                      aria-pressed={showAiKey}
                      onClick={() => setShowAiKey((shown) => !shown)}
                      className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center text-muted-foreground transition-colors duration-cut ease-mech hover:text-foreground aria-pressed:text-primary"
                    >
                      {showAiKey ? (
                        <EyeOff aria-hidden="true" className="size-3.5" />
                      ) : (
                        <Eye aria-hidden="true" className="size-3.5" />
                      )}
                    </button>
                  </div>
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

      {/* Danger zone */}
      <section>
        <SectionHeader title="Danger zone" />
        <div className="frame flex flex-wrap items-center justify-between gap-x-6 gap-y-4 border-danger/50 p-5">
          <div className="min-w-0 flex-1 basis-64">
            <p className="t-card">Delete account</p>
            <p className="t-meta mt-1.5">
              Once you delete your account, there is no going back. Please be certain.
            </p>
            <p className="t-meta mt-1.5">Account deletion isn&rsquo;t available here yet.</p>
          </div>
          <ConfirmButton
            label="Delete account"
            confirmLabel="Confirm delete"
            disabled
            onConfirm={() => {}}
          />
        </div>
      </section>
    </div>
  );
}
