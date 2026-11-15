"use client";

import { useState } from "react";
import { Disc3, Unplug } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Notice, SectionHeader } from "@/components/ui/page";
import { useToast } from "@/components/ui/toast";
import { TRY_AGAIN } from "@/lib/profile-errors";

export function SpotifySection({
  initialConnected,
  status,
}: {
  initialConnected: boolean;
  /** The `spotify` search param left by the connect callback. */
  status: string | null;
}) {
  const toast = useToast();
  const [spotifyConnected, setSpotifyConnected] = useState(initialConnected);
  const spotifyStatus = status;

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

  return (
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
  );
}
