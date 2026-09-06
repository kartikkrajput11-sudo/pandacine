import { MoreVertical, Search, Images, Pin, ListChecks, Info, Settings } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function GroupHeaderMenu({
  isAdmin,
  onSearch,
  onMedia,
  onPinned,
  onTasks,
  onInfo,
  onSettings,
}: {
  isAdmin: boolean;
  onSearch: () => void;
  onMedia: () => void;
  onPinned: () => void;
  onTasks: () => void;
  onInfo: () => void;
  onSettings: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="size-9 rounded-full bg-surface border border-border flex items-center justify-center text-candle-muted"
          aria-label="Group menu"
        >
          <MoreVertical className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 bg-surface border-border text-candle">
        <DropdownMenuItem onClick={onSearch} className="gap-2 cursor-pointer">
          <Search className="size-4 text-petal" />
          Search messages
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onMedia} className="gap-2 cursor-pointer">
          <Images className="size-4 text-petal" />
          Shared media
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onPinned} className="gap-2 cursor-pointer">
          <Pin className="size-4 text-petal" />
          Pinned messages
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onTasks} className="gap-2 cursor-pointer">
          <ListChecks className="size-4 text-petal" />
          Group tasks
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-border" />
        <DropdownMenuItem onClick={onInfo} className="gap-2 cursor-pointer">
          <Info className="size-4 text-candle-muted" />
          Group info
        </DropdownMenuItem>
        {isAdmin && (
          <DropdownMenuItem onClick={onSettings} className="gap-2 cursor-pointer">
            <Settings className="size-4 text-candle-muted" />
            Group settings
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
