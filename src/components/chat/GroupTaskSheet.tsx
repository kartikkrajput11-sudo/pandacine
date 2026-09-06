import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2, CheckCircle2, Circle, Calendar, User, Loader2 } from "lucide-react";
import { useGroupTasks, useCreateGroupTask, useUpdateGroupTask, useDeleteGroupTask, type GroupTask } from "@/hooks/useGroupTasks";
import { UserAvatar } from "@/components/UserAvatar";
import type { GroupMember } from "@/hooks/useGroupAdmin";

export function GroupTaskSheet({
  open,
  onOpenChange,
  groupId,
  members,
  meId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  groupId: string;
  members: GroupMember[];
  meId: string;
}) {
  const { data: tasks, isLoading } = useGroupTasks(groupId);
  const create = useCreateGroupTask();
  const update = useUpdateGroupTask();
  const del = useDeleteGroupTask();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");
  const [adding, setAdding] = useState(false);

  const pending = (tasks ?? []).filter((t) => t.status !== "done");
  const done = (tasks ?? []).filter((t) => t.status === "done");

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setAdding(true);
    await create.mutateAsync({
      groupId,
      title,
      description,
      assigneeId: assigneeId || null,
      dueDate: dueDate || null,
      createdBy: meId,
    });
    setTitle("");
    setDescription("");
    setAssigneeId("");
    setDueDate("");
    setAdding(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md bg-velvet border-l border-border p-0 flex flex-col">
        <SheetHeader className="px-5 pt-6 pb-3 border-b border-border shrink-0">
          <SheetTitle className="flex items-center gap-2 text-base tracking-wide text-candle">
            <CheckCircle2 className="size-4 text-petal" /> Group tasks
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          <ScrollArea className="flex-1 px-5 py-4">
            {isLoading && (
              <div className="flex items-center justify-center py-20 text-candle-muted text-sm">
                <Loader2 className="size-4 animate-spin mr-2" /> Loading tasks…
              </div>
            )}

            {!isLoading && pending.length === 0 && done.length === 0 && (
              <div className="text-center py-14 text-candle/50 text-sm">
                No tasks yet. Add one below to keep the group on track.
              </div>
            )}

            <div className="space-y-4 mb-6">
              {pending.map((t) => (
                <TaskCard key={t.id} task={t} members={members} meId={meId} onUpdate={update} onDelete={del} groupId={groupId} />
              ))}
            </div>

            {done.length > 0 && (
              <>
                <p className="text-[10px] uppercase tracking-wider text-candle/40 mb-3">Completed</p>
                <div className="space-y-4 opacity-60">
                  {done.map((t) => (
                    <TaskCard key={t.id} task={t} members={members} meId={meId} onUpdate={update} onDelete={del} groupId={groupId} />
                  ))}
                </div>
              </>
            )}
          </ScrollArea>

          <form onSubmit={handleAdd} className="shrink-0 border-t border-border bg-surface/40 px-5 py-4 space-y-3">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Add a task…"
              className="bg-velvet border-border text-candle placeholder:text-candle/30"
            />
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
              className="bg-velvet border-border text-candle placeholder:text-candle/30 text-sm"
            />
            <div className="flex gap-2">
              <div className="flex-1 min-w-0">
                <Label className="text-[10px] text-candle/50 flex items-center gap-1 mb-1.5">
                  <User className="size-3" /> Assignee
                </Label>
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="w-full h-9 rounded-md border border-border bg-velvet text-candle text-sm px-2"
                >
                  <option value="">Anyone</option>
                  {members.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.display_name || m.username || "Member"}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-[10px] text-candle/50 flex items-center gap-1 mb-1.5">
                  <Calendar className="size-3" /> Due
                </Label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="bg-velvet border-border text-candle text-sm h-9 w-36"
                />
              </div>
            </div>
            <Button
              type="submit"
              disabled={!title.trim() || adding}
              className="w-full bg-petal hover:bg-petal/90 text-velvet"
            >
              {adding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              <span className="ml-1.5">Add task</span>
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function TaskCard({
  task,
  members,
  meId,
  onUpdate,
  onDelete,
  groupId,
}: {
  task: GroupTask;
  members: GroupMember[];
  meId: string;
  onUpdate: ReturnType<typeof useUpdateGroupTask>;
  onDelete: ReturnType<typeof useDeleteGroupTask>;
  groupId: string;
}) {
  const assignee = members.find((m) => m.user_id === task.assignee_id) || task.assignee;
  const canDelete = task.created_by === meId;

  return (
    <div className="rounded-2xl bg-surface/60 border border-border p-3.5 transition hover:border-border/80">
      <div className="flex items-start gap-3">
        <button
          onClick={() => onUpdate.mutate({ taskId: task.id, groupId, status: task.status === "done" ? "pending" : "done" })}
          className="mt-0.5 shrink-0 text-candle/50 hover:text-petal transition"
          aria-label={task.status === "done" ? "Mark pending" : "Mark done"}
        >
          {task.status === "done" ? <CheckCircle2 className="size-5 text-emerald-400" /> : <Circle className="size-5" />}
        </button>
        <div className="flex-1 min-w-0">
          <p className={`text-sm text-candle leading-snug ${task.status === "done" ? "line-through text-candle/40" : ""}`}>
            {task.title}
          </p>
          {task.description && (
            <p className="text-xs text-candle-muted mt-1 line-clamp-2">{task.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2.5 flex-wrap">
            {task.assignee_id && (
              <div className="flex items-center gap-1.5 text-[10px] text-candle/55 bg-velvet/50 px-2 py-1 rounded-full border border-border">
                <UserAvatar
                  src={assignee?.avatar_url ?? null}
                  name={assignee?.display_name || assignee?.username || null}
                  className="size-4"
                />
                {assignee?.display_name || assignee?.username || "Assigned"}
              </div>
            )}
            {task.due_date && (
              <div className="text-[10px] text-candle/55 bg-velvet/50 px-2 py-1 rounded-full border border-border">
                <Calendar className="inline size-3 mr-1 -mt-0.5" />
                {new Date(task.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </div>
            )}
            {canDelete && (
              <button
                onClick={() => onDelete.mutate({ taskId: task.id, groupId })}
                className="ml-auto text-candle/30 hover:text-rose-400 transition"
                aria-label="Delete task"
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
