"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
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
  Loader2
} from "lucide-react";

interface ProfileProps {
  profile: {
    id: string;
    email: string;
    fullName: string;
    username: string;
    createdAt: string;
  };
}

type WatchLog = {
  rating: number;
  review: string | null;
  media_type: "movie" | "tv";
  created_at: string;
};

export function ProfileClient({ profile }: ProfileProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState(profile.fullName);
  const [username, setUsername] = useState(profile.username);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [watchLogs, setWatchLogs] = useState<WatchLog[]>([]);
  const [watchlistCount, setWatchlistCount] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);

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

  const memberSince = new Date(profile.createdAt).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex flex-col gap-8 max-w-4xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col items-center text-center gap-6 pb-8 border-b-2 border-border">
        {/* Avatar */}
        <div className="relative group">
          <div className="w-28 h-28 border-4 border-primary p-1">
            <div className="w-full h-full bg-card flex items-center justify-center">
              <span className="font-display text-4xl font-bold text-primary">
                {fullName.charAt(0).toUpperCase() || profile.email.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
          <button className="absolute bottom-0 right-0 w-8 h-8 bg-primary text-primary-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera className="w-4 h-4" />
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
      )}

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
