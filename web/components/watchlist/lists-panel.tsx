import Link from "next/link";
import { ListChecks, ListMusic, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Input, Textarea } from "@/components/ui/input";
import { RowListSkeleton } from "@/components/ui/loading";
import { EmptyState, Field, Notice, SectionHeader } from "@/components/ui/page";
import { countLabel, formatDay } from "@/lib/media";

export type UserList = {
  id: string;
  name: string;
  description: string | null;
  emoji: string | null;
  list_type: "film" | "music";
  created_at: string;
  updated_at: string;
  list_items: { count: number }[];
};

/**
 * The Lists tab of the watchlist page. Presentational only: the page owns the
 * state and the fetches so they outlive a switch between tabs.
 */
export function ListsPanel({
  lists,
  loading,
  failed,
  isMusicMode,
  showCreateForm,
  newListName,
  newListDescription,
  newListEmoji,
  emojiOptions,
  creatingList,
  onOpenForm,
  onCloseForm,
  onNameChange,
  onDescriptionChange,
  onEmojiChange,
  onCreate,
  onDelete,
}: {
  lists: UserList[];
  loading: boolean;
  failed: boolean;
  isMusicMode: boolean;
  showCreateForm: boolean;
  newListName: string;
  newListDescription: string;
  newListEmoji: string;
  emojiOptions: string[];
  creatingList: boolean;
  onOpenForm: () => void;
  onCloseForm: () => void;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onEmojiChange: (emoji: string) => void;
  onCreate: () => void;
  onDelete: (list: UserList) => void;
}) {
  return (
    <div
      role="tabpanel"
      id="watchlist-panel-lists"
      aria-labelledby="watchlist-tab-lists"
      className="mt-8"
    >
      <SectionHeader
        title="Your lists"
        meta={loading || failed ? undefined : `${lists.length} ${lists.length === 1 ? "list" : "lists"}`}
        action={
          !showCreateForm && lists.length > 0 ? (
            <Button variant="outline" size="sm" onClick={() => onOpenForm()}>
              <Plus aria-hidden="true" /> New list
            </Button>
          ) : undefined
        }
      />

      {/* Create list */}
      {showCreateForm && (
        <form
          className="frame frame-accent drawer-in mb-8 flex max-w-2xl flex-col gap-5 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            onCreate();
          }}
        >
          <h3 className="t-card">New list</h3>

          <fieldset className="flex flex-col gap-2">
            <legend className="t-label mb-2">Pick an icon</legend>
            <div className="flex flex-wrap gap-2">
              {emojiOptions.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  aria-pressed={newListEmoji === emoji}
                  aria-label={`Use ${emoji} as the icon`}
                  onClick={() => onEmojiChange(emoji)}
                  className={`flex h-10 w-10 items-center justify-center border text-[18px] transition-colors duration-cut ease-mech ${
                    newListEmoji === emoji
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background hover:border-border-strong"
                  }`}
                >
                  <span aria-hidden="true">{emoji}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <Field label="Name" htmlFor="list-name">
            <Input
              id="list-name"
              required
              placeholder={isMusicMode ? "e.g. Chill Vibes Playlist" : "e.g. Movie Night with Friends"}
              value={newListName}
              onChange={(e) => onNameChange(e.target.value)}
            />
          </Field>

          <Field label="Description (optional)" htmlFor="list-description">
            <Textarea
              id="list-description"
              placeholder="What's this list about?"
              value={newListDescription}
              onChange={(e) => onDescriptionChange(e.target.value)}
              rows={2}
              className="min-h-[72px]"
            />
          </Field>

          <div className="flex flex-wrap gap-2.5">
            <Button type="submit" disabled={!newListName.trim() || creatingList}>
              <Plus aria-hidden="true" /> {creatingList ? "Creating" : "Create list"}
            </Button>
            <Button type="button" variant="outline" onClick={onCloseForm}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {/* Lists */}
      {loading ? (
        <RowListSkeleton count={3} />
      ) : failed ? (
        <Notice tone="error" title="Couldn't load your lists">
          Check your connection and reload the page.
        </Notice>
      ) : lists.length === 0 ? (
        !showCreateForm && (
          <EmptyState
            icon={isMusicMode ? ListMusic : ListChecks}
            title="No lists yet."
            description={
              isMusicMode
                ? "Create lists to organise albums and tracks by genre, mood, or vibe."
                : "Create lists to organise films and shows by genre, mood, or occasion."
            }
            action={
              <Button onClick={() => onOpenForm()}>
                <Plus aria-hidden="true" /> Create your first list
              </Button>
            }
          />
        )
      ) : (
        <ul className="advance">
          {lists.map((list) => {
            const itemCount = list.list_items?.[0]?.count ?? 0;
            return (
              <li key={list.id} className="row-item relative flex items-center gap-4 px-2 py-4">
                <span
                  aria-hidden="true"
                  className="flex h-11 w-11 shrink-0 items-center justify-center border border-border bg-surface-2 text-[20px]"
                >
                  {list.emoji || (list.list_type === "music" ? "🎵" : "🎬")}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="t-card truncate">
                    <Link
                      href={`/protected/lists/${list.id}`}
                      className="after:absolute after:inset-0 after:content-['']"
                    >
                      {list.name}
                    </Link>
                  </h3>
                  {list.description && (
                    <p className="t-meta mt-1 line-clamp-2">{list.description}</p>
                  )}
                  <p className="t-meta mt-1">
                    {countLabel(itemCount, isMusicMode)} · Created {(list.created_at ? formatDay(list.created_at) : "")}
                  </p>
                </div>
                <ConfirmButton
                  iconOnly
                  label={`Delete ${list.name}`}
                  confirmLabel="Delete list"
                  className="relative z-[2] shrink-0"
                  onConfirm={() => onDelete(list)}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
