"use client";

import { useState } from "react";
import { Film, Grid3x3, List, Music2, Pencil, Plus, Search, Tv } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { LoadingLine, RowListSkeleton, Skeleton } from "@/components/ui/loading";
import { MediaCard, MediaGrid } from "@/components/ui/media-card";
import {
  Avatar,
  EmptyState,
  Field,
  LeaderRow,
  Notice,
  PageHeader,
  SectionHeader,
  StatBlock,
} from "@/components/ui/page";
import { SegmentedControl, TabBar } from "@/components/ui/segmented-control";
import { StarInput, Stars } from "@/components/ui/stars";
import { useToast } from "@/components/ui/toast";
import { NavAccentBar, NavModeToggle, ReelCueMark } from "@/components/nav-client";
import { useMode } from "@/lib/mode-context";

export function Kit() {
  const { mode } = useMode();
  const toast = useToast();
  const [filter, setFilter] = useState<"all" | "film" | "tv">("all");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [tab, setTab] = useState<"overview" | "taste" | "history">("overview");
  const [rating, setRating] = useState(3.5);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50">
        <NavAccentBar />
        <div className="relative flex h-[60px] items-center justify-between border-b border-[var(--border-raw)] bg-[var(--bg)] px-6">
          <ReelCueMark />
          <span className="font-display text-[22px] font-semibold">TrackEfron kit</span>
          <NavModeToggle />
        </div>
      </header>

      <main className="shutter-in mx-auto flex max-w-[1200px] flex-col gap-16 px-4 py-10 sm:px-6">
        <PageHeader
          title={
            <>
              Welcome, <strong>Rohan</strong>
              <br />
              <em>{mode === "music" ? "what are you listening to?" : "what are you watching?"}</em>
            </>
          }
          description="Every primitive in the system, in the live mode. Switch mode in the header to see film and music side by side."
          actions={
            <>
              <Button variant="outline">View library</Button>
              <Button>
                <Plus /> Log a watch
              </Button>
            </>
          }
        />

        <section>
          <SectionHeader title="Figures" meta="This month" />
          <div className="flex flex-wrap gap-x-12 gap-y-6">
            <StatBlock label="Watched" value={128} />
            <StatBlock label="Reviews" value={64} />
            <StatBlock label="Avg rating" value="3.8" />
            <StatBlock label="Loading" value={0} loading />
          </div>
          <div className="mt-8 max-w-sm">
            <LeaderRow label="Longest streak" value="14 days" />
            <LeaderRow label="Top genre" value="Drama" />
            <LeaderRow label="Hours watched" value="212" />
          </div>
        </section>

        <section>
          <SectionHeader title="Buttons and tags" />
          <div className="flex flex-wrap items-center gap-3">
            <Button>Primary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="link">Link</Button>
            <Button disabled>Disabled</Button>
            <Button size="sm">Small</Button>
            <Button size="lg">Large</Button>
            <Button size="icon" variant="outline" aria-label="Edit">
              <Pencil />
            </Button>
            <ConfirmButton onConfirm={() => toast({ mark: "Removed", title: "Entry removed", tone: "info" })} />
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Badge>Default</Badge>
            <Badge variant="solid">Solid</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="success">Watched</Badge>
            <Badge variant="warning">Pending</Badge>
            <Badge variant="destructive">Error</Badge>
            <Badge variant="film">Film</Badge>
            <Badge variant="music">Music</Badge>
          </div>
        </section>

        <section>
          <SectionHeader title="Choosing" />
          <div className="flex flex-wrap items-center gap-4">
            <SegmentedControl
              label="Filter by type"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "All", count: 128 },
                { value: "film", label: "Films", icon: Film, count: 96 },
                { value: "tv", label: "TV", icon: Tv, count: 32 },
              ]}
            />
            <SegmentedControl
              label="View"
              value={view}
              onChange={setView}
              options={[
                { value: "grid", label: "Grid", icon: Grid3x3, iconOnly: true },
                { value: "list", label: "List", icon: List, iconOnly: true },
              ]}
            />
          </div>
          <TabBar
            className="mt-8"
            label="Analytics sections"
            value={tab}
            onChange={setTab}
            tabs={[
              { value: "overview", label: "Overview" },
              { value: "taste", label: "Taste", count: 6 },
              { value: "history", label: "History" },
            ]}
          />
        </section>

        <section>
          <SectionHeader title="Forms" />
          <div className="grid max-w-3xl gap-6 md:grid-cols-2">
            <Field label="Title" htmlFor="kit-title" hint="Search films, shows, albums or tracks.">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input id="kit-title" placeholder="Start typing a title" className="pl-9" />
              </div>
            </Field>
            <Field label="Watched on" htmlFor="kit-date">
              <Input id="kit-date" type="date" defaultValue="2026-11-14" />
            </Field>
            <Field label="Where" htmlFor="kit-where">
              <Select id="kit-where" defaultValue="cinema">
                <option value="cinema">Cinema</option>
                <option value="home">At home</option>
                <option value="plane">On a plane</option>
              </Select>
            </Field>
            <Field label="Email" htmlFor="kit-email" error="Enter an email address like name@example.com.">
              <Input id="kit-email" aria-invalid="true" defaultValue="rohan@" />
            </Field>
            <Field label="Review" htmlFor="kit-review" className="md:col-span-2">
              <Textarea id="kit-review" placeholder="What stayed with you?" />
            </Field>
            <div className="flex items-center gap-3">
              <Checkbox id="kit-rewatch" defaultChecked />
              <label htmlFor="kit-rewatch" className="text-[12px]">
                This was a rewatch
              </label>
            </div>
            <div className="flex flex-col gap-2">
              <span className="label-upper">Overall rating</span>
              <div className="flex items-center gap-4">
                <StarInput label="Overall rating" value={rating} onChange={setRating} />
                <Stars value={rating} showValue />
              </div>
            </div>
          </div>
        </section>

        <section>
          <SectionHeader
            title={mode === "music" ? "Recent listens" : "Recent watches"}
            meta="5 of 128"
            action={
              <Button variant="link" size="sm">
                View all
              </Button>
            }
          />
          <MediaGrid>
            {["Aftersun", "Past Lives", "The Zone of Interest", "Perfect Days", "Anatomy of a Fall"].map(
              (t, i) => (
                <MediaCard
                  key={t}
                  title={t}
                  subtitle={`Film · 202${i % 4}`}
                  aspect={mode === "music" ? "square" : "poster"}
                  href="#"
                  rating={i === 4 ? null : 5 - i * 0.5}
                  fallbackIcon={mode === "music" ? Music2 : Film}
                  badge={i === 0 ? <Badge variant="solid">New</Badge> : undefined}
                  caption={i < 2 ? "A quiet film that keeps arriving days later." : undefined}
                  actions={
                    <Button size="icon" variant="secondary" aria-label={`Edit ${t}`} className="h-8 w-8">
                      <Pencil />
                    </Button>
                  }
                />
              ),
            )}
          </MediaGrid>
        </section>

        <section className="grid gap-8 md:grid-cols-2">
          <div>
            <SectionHeader title="Frames" as="h3" />
            <div className="flex flex-col gap-6">
              <div className="frame p-5">
                <p className="t-card">Plain frame</p>
                <p className="t-meta mt-1">Hairline, filled, square.</p>
              </div>
              <div className="frame frame-accent frame-interactive p-5" tabIndex={0}>
                <p className="t-card">Interactive frame with the accent line</p>
                <p className="t-meta mt-1">Hover or focus: the line thickens, the edge strengthens.</p>
              </div>
              <div className="light-leak">
                <div className="frame frame-accent frame-raised ticks p-5">
                  <p className="t-card">Feature frame</p>
                  <p className="t-prose mt-2">
                    Raised, with registration ticks in film and a bevel in music, over a single light leak.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div>
            <SectionHeader title="States" as="h3" />
            <div className="flex flex-col gap-4">
              <Notice tone="error" title="Couldn't save">
                Check your connection and try again. Your review is still here.
              </Notice>
              <Notice tone="success">Spotify connected.</Notice>
              <Notice tone="warning">Your session expires in 5 minutes.</Notice>
              <LoadingLine label="Searching" />
              <RowListSkeleton count={2} />
              <div className="flex items-center gap-3">
                <Avatar name="Rohan" size={40} />
                <Avatar name="" size={32} />
                <Skeleton className="h-10 w-40" />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => toast({ mark: "Logged", title: "Aftersun added to your library" })}
                >
                  Toast: logged
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    toast({ mark: "Failed", tone: "error", title: "Couldn't delete that entry", description: "Try again in a moment." })
                  }
                >
                  Toast: error
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="frame">
          <EmptyState
            icon={mode === "music" ? Music2 : Film}
            title={mode === "music" ? "No listens logged yet" : "Your story starts here."}
            description="Log the first thing you watched and it will appear here."
            action={
              <Button>
                <Plus /> Log your first watch
              </Button>
            }
          />
        </section>
      </main>
    </div>
  );
}
