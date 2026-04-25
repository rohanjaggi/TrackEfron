"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { syncProfile } from "@/lib/sync-profile";
import {
  User,
  AtSign,
  Mail,
  Calendar,
  Film,
  Star,
  Edit3,
  Check,
  X,
  Camera,
  BookOpen,
  Clock,
  Loader2,
  Disc3,
  Key,
  Trash2
} from "lucide-react";
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

function extractDominantColor(file: File): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 50 / Math.max(img.width, img.height));
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d")!;
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
        resolve("#6366f1");
      } else {
        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);
        resolve(`#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`);
      }
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  });
}

export function ProfileClient({ profile }: ProfileProps) {
  const searchParams = useSearchParams();
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState(profile.fullName);
  const [username, setUsername] = useState(profile.username);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl);
  const [profileColor, setProfileColor] = useState(profile.profileColor);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [watchLogs, setWatchLogs] = useState<WatchLog[]>([]);
  const [watchlistCount, setWatchlistCount] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);
  const [spotifyConnected, setSpotifyConnected] = useState(profile.spotifyConnected);
  const [spotifyLoading, setSpotifyLoading] = useState(false);
  const spotifyStatus = searchParams.get("spotify");

  const [aiKeyInput, setAiKeyInput] = useState("");
  const [aiKeyInfo, setAiKeyInfo] = useState<{ hasKey: boolean; provider: string | null; maskedKey: string | null; source: string } | null>(null);
  const [aiKeyLoading, setAiKeyLoading] = useState(true);
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
        setWatchLogs(logsRes.data || []);
        setWatchlistCount(watchlistRes.count || 0);

      } catch {
        // silently fail
      } finally {
        setStatsLoading(false);
      }
    }
    fetchStats();
  }, []);

  useEffect(() => {
    fetch("/api/ai/settings")
      .then((r) => r.json())
      .then(setAiKeyInfo)
      .catch(() => {})
      .finally(() => setAiKeyLoading(false));
  }, []);

  const handleSaveAiKey = async () => {
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
        setAiKeyError(data.error);
        return;
      }
      setAiKeyInfo(data);
      setAiKeyInput("");
    } catch {
      setAiKeyError("Failed to save API key");
    } finally {
      setAiKeySaving(false);
    }
  };

  const handleRemoveAiKey = async () => {
    setAiKeySaving(true);
    setAiKeyError(null);
    try {
      const res = await fetch("/api/ai/settings", { method: "DELETE" });
      const data = await res.json();
      setAiKeyInfo(data);
    } catch {
      setAiKeyError("Failed to remove API key");
    } finally {
      setAiKeySaving(false);
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
    setSpotifyLoading(true);
    try {
      await fetch("/api/spotify/disconnect", { method: "POST" });
      setSpotifyConnected(false);
    } finally {
      setSpotifyLoading(false);
    }
  };

  const handleSave = async () => {
    const supabase = createClient();
    setIsSaving(true);
    setError(null);
    setSuccess(false);

    if (!fullName.trim()) {
      setError("Name cannot be empty");
      setIsSaving(false);
      return;
    }

    if (!username.trim() || username.length < 3) {
      setError("Username must be at least 3 characters");
      setIsSaving(false);
      return;
    }

    if (!/^[a-z0-9_]+$/.test(username)) {
      setError("Username can only contain lowercase letters, numbers, and underscores");
      setIsSaving(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: fullName.trim(),
          username: username.toLowerCase().trim(),
        },
      });

      if (error) throw error;

      // Keep profiles table in sync
      await syncProfile(supabase);

      setSuccess(true);
      setIsEditing(false);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setFullName(profile.fullName);
    setUsername(profile.username);
    setIsEditing(false);
    setError(null);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX_SIZE = 2 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setError("Image must be under 2MB");
      return;
    }
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Only PNG, JPEG, and WebP images are allowed");
      return;
    }

    setIsUploading(true);
    setError(null);

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
          profile_color: dominantColor,
        },
      });

      if (updateError) throw updateError;

      // Keep profiles table in sync
      await syncProfile(supabase);

      setAvatarUrl(`${publicUrl}?t=${Date.now()}`);
      setProfileColor(dominantColor);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to upload avatar");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const memberSince = new Date(profile.createdAt).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex flex-col gap-8 max-w-4xl mx-auto w-full">
      {/* Backdrop Banner — full viewport width, pull up into layout padding */}
      <div className="relative -mb-20 -mt-10 h-44 w-screen left-1/2 -translate-x-1/2">
        <div
          className="absolute inset-0"
          style={{
            background: profileColor
              ? `radial-gradient(ellipse 80% 100% at 50% 0%, ${profileColor}40 0%, ${profileColor}18 50%, transparent 100%)`
              : "radial-gradient(ellipse 80% 100% at 50% 0%, hsl(var(--primary) / 0.15) 0%, hsl(var(--primary) / 0.05) 50%, transparent 100%)",
          }}
        />
      </div>

      {/* Header */}
      <div className="flex flex-col items-center text-center gap-6 pb-8 border-b-2 border-border">
        {/* Avatar */}
        <div className="relative group">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleAvatarUpload}
          />
          <div className="w-28 h-28 border-4 border-primary p-1 bg-card">
            <div className="w-full h-full bg-card flex items-center justify-center overflow-hidden">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="font-display text-4xl font-bold text-primary">
                  {fullName.charAt(0).toUpperCase() || profile.email.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="absolute bottom-0 right-0 w-8 h-8 bg-primary text-primary-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
          </button>
        </div>

        {/* Name & Username */}
        <div>
          <h1 className="font-display text-3xl font-bold mb-1">{fullName || "Set your name"}</h1>
          <p className="text-muted-foreground">
            @{username || "username"}
          </p>
        </div>

        {/* Member Since */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="w-4 h-4" />
          <span>Member since {memberSince}</span>
        </div>
      </div>

      {/* Stats */}
      {statsLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Row 1: Core stats */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
            <div className="border-2 border-border p-5 text-center">
              <Film className="w-5 h-5 text-primary mx-auto mb-2" />
              <div className="text-2xl font-bold">{stats.watched}</div>
              <p className="text-xs text-muted-foreground">Watched</p>
            </div>
            <div className="border-2 border-border p-5 text-center">
              <Film className="w-5 h-5 text-accent mx-auto mb-2" />
              <div className="text-2xl font-bold">{stats.movies}</div>
              <p className="text-xs text-muted-foreground">{stats.movies === 1 ? "Movie" : "Movies"}</p>
            </div>
            <div className="border-2 border-border p-5 text-center">
              <Film className="w-5 h-5 text-secondary mx-auto mb-2" />
              <div className="text-2xl font-bold">{stats.tvShows}</div>
              <p className="text-xs text-muted-foreground">{stats.tvShows === 1 ? "TV Show" : "TV Shows"}</p>
            </div>
            <div className="border-2 border-border p-5 text-center">
              <BookOpen className="w-5 h-5 text-accent mx-auto mb-2" />
              <div className="text-2xl font-bold">{stats.reviews}</div>
              <p className="text-xs text-muted-foreground">{stats.reviews === 1 ? "Review" : "Reviews"}</p>
            </div>
            <div className="border-2 border-border p-5 text-center">
              <Star className="w-5 h-5 text-accent fill-accent mx-auto mb-2" />
              <div className="text-2xl font-bold">{stats.avgRating}</div>
              <p className="text-xs text-muted-foreground">Avg Rating</p>
            </div>
            <div className="border-2 border-border p-5 text-center">
              <Clock className="w-5 h-5 text-primary mx-auto mb-2" />
              <div className="text-2xl font-bold">{stats.watchlist}</div>
              <p className="text-xs text-muted-foreground">Watchlist</p>
            </div>
          </div>
        </div>
      )}

      {/* Taste DNA */}
      <TasteDNACard />

      {/* Profile Details */}
      <div className="border-2 border-border p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-xl font-semibold">Profile Details</h2>
          {!isEditing ? (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setIsEditing(true)}
              className="border-2"
            >
              <Edit3 className="w-4 h-4 mr-2" />
              Edit Profile
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleCancel}
                disabled={isSaving}
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button 
                size="sm" 
                onClick={handleSave}
                disabled={isSaving}
                className="border-2"
              >
                <Check className="w-4 h-4 mr-2" />
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 border-2 border-destructive bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 border-2 border-green-500 bg-green-500/10 text-green-500 text-sm">
            Profile updated successfully!
          </div>
        )}

        <div className="space-y-6">
          {/* Full Name */}
          <div className="grid gap-2">
            <Label htmlFor="fullName" className="flex items-center gap-2 text-muted-foreground">
              <User className="w-4 h-4" />
              Full Name
            </Label>
            {isEditing ? (
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="bg-card border-2 border-border"
              />
            ) : (
              <p className="text-lg">{fullName || "Not set"}</p>
            )}
          </div>

          {/* Username */}
          <div className="grid gap-2">
            <Label htmlFor="username" className="flex items-center gap-2 text-muted-foreground">
              <AtSign className="w-4 h-4" />
              Username
            </Label>
            {isEditing ? (
              <>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  className="bg-card border-2 border-border"
                />
                <p className="text-xs text-muted-foreground">
                  Lowercase letters, numbers, and underscores only
                </p>
              </>
            ) : (
              <p className="text-lg">@{username || "Not set"}</p>
            )}
          </div>

          {/* Email (read-only) */}
          <div className="grid gap-2">
            <Label className="flex items-center gap-2 text-muted-foreground">
              <Mail className="w-4 h-4" />
              Email
            </Label>
            <p className="text-lg">{profile.email}</p>
            <p className="text-xs text-muted-foreground">
              Email cannot be changed
            </p>
          </div>
        </div>
      </div>

      {/* Connected Services */}
      <div className="border-2 border-border p-6">
        <h2 className="font-display text-xl font-semibold mb-4">Connected Services</h2>

        {spotifyStatus === "connected" && (
          <div className="mb-4 p-3 border-2 border-green-500 bg-green-500/10 text-green-500 text-sm">
            Spotify connected successfully!
          </div>
        )}
        {spotifyStatus === "denied" && (
          <div className="mb-4 p-3 border-2 border-yellow-500 bg-yellow-500/10 text-yellow-500 text-sm">
            Spotify connection was denied.
          </div>
        )}
        {spotifyStatus === "error" && (
          <div className="mb-4 p-3 border-2 border-destructive bg-destructive/10 text-destructive text-sm">
            Something went wrong connecting to Spotify. Please try again.
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className="w-10 h-10 flex items-center justify-center border-2"
              style={{ borderColor: "#1DB954", color: "#1DB954" }}
            >
              <Disc3 className="w-5 h-5" />
            </div>
            <div>
              <p className="font-medium">Spotify</p>
              <p className="text-xs text-muted-foreground">
                {spotifyConnected
                  ? "Connected — enables personalised music recommendations"
                  : "Connect to unlock personalised music recommendations"}
              </p>
            </div>
          </div>

          {spotifyConnected ? (
            <Button
              variant="outline"
              size="sm"
              className="border-2"
              onClick={handleSpotifyDisconnect}
              disabled={spotifyLoading}
            >
              {spotifyLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Disconnect"}
            </Button>
          ) : (
            <a href="/api/spotify/connect">
              <Button
                size="sm"
                className="border-2"
                style={{ backgroundColor: "#1DB954", color: "#000", borderColor: "#1DB954" }}
              >
                Connect
              </Button>
            </a>
          )}
        </div>
      </div>

      {/* AI Settings */}
      <div className="border-2 border-border p-6">
        <h2 className="font-display text-xl font-semibold mb-4">AI Settings</h2>

        {aiKeyLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading...</span>
          </div>
        ) : aiKeyInfo?.source === "env" ? (
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 flex items-center justify-center border-2 border-primary text-primary">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <p className="font-medium">Server Configured</p>
              <p className="text-xs text-muted-foreground">
                AI features are configured by the server ({aiKeyInfo.provider === "openai" ? "OpenAI" : "Anthropic"})
              </p>
            </div>
          </div>
        ) : aiKeyInfo?.hasKey ? (
          <div>
            {aiKeyError && (
              <div className="mb-4 p-3 border-2 border-destructive bg-destructive/10 text-destructive text-sm">
                {aiKeyError}
              </div>
            )}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 flex items-center justify-center border-2 border-green-500 text-green-500">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{aiKeyInfo.maskedKey}</p>
                    <span className="text-xs px-2 py-0.5 border border-primary text-primary">
                      {aiKeyInfo.provider === "anthropic" ? "Anthropic" : "OpenAI"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Powers Taste DNA, recommendations, and vibe search
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-2 text-destructive hover:text-destructive"
                onClick={handleRemoveAiKey}
                disabled={aiKeySaving}
              >
                {aiKeySaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        ) : (
          <div>
            {aiKeyError && (
              <div className="mb-4 p-3 border-2 border-destructive bg-destructive/10 text-destructive text-sm">
                {aiKeyError}
              </div>
            )}
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 flex items-center justify-center border-2 border-muted-foreground text-muted-foreground">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <p className="font-medium">No API Key</p>
                <p className="text-xs text-muted-foreground">
                  Add an Anthropic or OpenAI key to enable AI-powered features
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Input
                  value={aiKeyInput}
                  onChange={(e) => setAiKeyInput(e.target.value)}
                  placeholder="sk-ant-... / sk-... / AIza..."
                  className="bg-card border-2 border-border pr-24"
                  type="password"
                />
                {detectedProvider && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs px-2 py-0.5 border border-primary text-primary">
                    {detectedProvider}
                  </span>
                )}
              </div>
              <Button
                size="default"
                className="border-2"
                onClick={handleSaveAiKey}
                disabled={aiKeySaving || !aiKeyInput}
              >
                {aiKeySaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Danger Zone */}
      <div className="bg-destructive/5 border-2 border-destructive p-6">
        <h2 className="font-display text-xl font-semibold text-destructive mb-2">Danger Zone</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Once you delete your account, there is no going back. Please be certain.
        </p>
        <Button variant="destructive" size="sm" className="border-2">
          Delete Account
        </Button>
      </div>
    </div>
  );
}
