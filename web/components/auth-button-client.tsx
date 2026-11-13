"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { User, LogOut, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar } from "@/components/ui/page";

interface AuthButtonClientProps {
  displayName: string;
  avatarUrl: string | null;
}

export function AuthButtonClient({ displayName, avatarUrl }: AuthButtonClientProps) {
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Account menu for ${displayName}`}
          className="flex h-9 items-center gap-2 border border-transparent px-1.5 transition-[background-color,border-color] duration-cut ease-mech hover:border-border hover:bg-surface-2 data-[state=open]:border-border-strong data-[state=open]:bg-surface-2"
        >
          <Avatar src={avatarUrl} name={displayName} size={26} />
          <span className="hidden max-w-[120px] truncate text-[12px] font-medium xl:inline">
            {displayName}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          className="cursor-pointer"
          onSelect={() => router.push("/protected/profile")}
        >
          <User aria-hidden="true" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer text-muted-foreground"
          onSelect={handleLogout}
        >
          <LogOut aria-hidden="true" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
