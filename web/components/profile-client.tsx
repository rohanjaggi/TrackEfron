"use client";

import { useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Avatar,
  Field,
  Notice,
  PageHeader,
  SectionHeader,
} from "@/components/ui/page";
import { useToast } from "@/components/ui/toast";
import { AiSettingsSection } from "@/components/profile/ai-settings-section";
import { SpotifySection } from "@/components/profile/spotify-section";
import { StatsSection } from "@/components/profile/stats-section";
import { extractDominantColor } from "@/lib/dominant-color";
import { useMode } from "@/lib/mode-context";
import { TRY_AGAIN, saveErrorMessage } from "@/lib/profile-errors";
import { createClient } from "@/lib/supabase/client";
import { syncProfile } from "@/lib/sync-profile";

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

const formatMonthYear = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

export function ProfileClient({ profile }: ProfileProps) {
  const searchParams = useSearchParams();
  const toast = useToast();
  const { mode } = useMode();

  // Profile details
  const [saved, setSaved] = useState({ fullName: profile.fullName, username: profile.username });
  const [fullName, setFullName] = useState(profile.fullName);
  const [username, setUsername] = useState(profile.username);
  const [nameError, setNameError] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Photo
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl);
  const [profileColor, setProfileColor] = useState(profile.profileColor);
  const [isUploading, setIsUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isDirty = fullName !== saved.fullName || username !== saved.username;

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSaving) return;
    setSaveError(null);

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

      // Keep the public profiles row (friend search, profile pages) in step with the account.
      if (!(await syncProfile(supabase))) {
        toast({
          mark: "Failed",
          tone: "error",
          title: "Your public profile didn't update",
          description: "Friends may still see your old details. Try saving again.",
        });
      }

      setFullName(nextFullName);
      setUsername(nextUsername);
      setSaved({ fullName: nextFullName, username: nextUsername });
      toast({ mark: "Saved", title: "Profile updated" });
    } catch (err: unknown) {
      console.error("Profile save failed:", err);
      setSaveError(saveErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = () => {
    setFullName(saved.fullName);
    setUsername(saved.username);
    setNameError(null);
    setUsernameError(null);
    setSaveError(null);
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

      if (!(await syncProfile(supabase))) {
        toast({
          mark: "Failed",
          tone: "error",
          title: "Your public profile didn't update",
          description: "Friends may still see your old photo. Try uploading again.",
        });
      }

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

      <StatsSection mode={mode} />

      {/* Profile details */}
      <section>
        <SectionHeader title="Profile details" />
        <form onSubmit={handleSave} noValidate className="flex max-w-xl flex-col gap-6">
          {saveError && (
            <Notice tone="error" title="Couldn't save your profile">
              {saveError} Your changes are still here.
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
            />
          </Field>

          <Field label="Email" htmlFor="email" hint="Email cannot be changed">
            <Input
              id="email"
              type="email"
              value={profile.email}
              readOnly
              className="text-muted-foreground"
            />
          </Field>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              type="submit"
              variant={isDirty ? "default" : "outline"}
              disabled={isSaving || !isDirty}
            >
              {isSaving ? "Saving…" : "Save changes"}
            </Button>
            {isDirty ? (
              <Button variant="ghost" onClick={handleDiscard} disabled={isSaving}>
                Discard changes
              </Button>
            ) : (
              <span className="t-meta">No changes to save</span>
            )}
          </div>
        </form>
      </section>

      <SpotifySection initialConnected={profile.spotifyConnected} status={searchParams.get("spotify")} />

      <AiSettingsSection />

      {/* Danger zone */}
      <section>
        <SectionHeader title="Danger zone" />
        <Notice tone="warning" title="Account deletion isn't available yet" className="max-w-xl">
          You can&rsquo;t delete your account from the app yet. Nothing here will remove it.
        </Notice>
      </section>
    </div>
  );
}