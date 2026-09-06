import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type GroupTaskStatus = Database["public"]["Enums"]["group_task_status"];

export type GroupTask = {
  id: string;
  group_id: string;
  title: string;
  description: string | null;
  assignee_id: string | null;
  created_by: string;
  status: GroupTaskStatus;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  assignee?: { display_name: string | null; avatar_url: string | null } | null;
};

export function useGroupTasks(groupId: string | null) {
  const qc = useQueryClient();
  const q = useQuery({
    enabled: !!groupId,
    queryKey: ["group-tasks", groupId],
    queryFn: async (): Promise<GroupTask[]> => {
      if (!groupId) return [];
      const { data, error } = await supabase
        .from("group_tasks")
        .select("*, assignee:profiles!group_tasks_assignee_id_fkey(display_name, avatar_url)")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as GroupTask[];
    },
  });

  useEffect(() => {
    if (!groupId) return;
    const ch = supabase
      .channel(`group-tasks-${groupId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_tasks", filter: `group_id=eq.${groupId}` },
        () => qc.invalidateQueries({ queryKey: ["group-tasks", groupId] }),
      )
      .subscribe();
    return () => void supabase.removeChannel(ch);
  }, [groupId, qc]);

  return q;
}

export function useCreateGroupTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      groupId: string;
      title: string;
      description?: string;
      assigneeId?: string | null;
      dueDate?: string | null;
      createdBy: string;
    }) => {
      const { data, error } = await supabase
        .from("group_tasks")
        .insert({
          group_id: input.groupId,
          title: input.title.trim(),
          description: input.description?.trim() || null,
          assignee_id: input.assigneeId ?? null,
          due_date: input.dueDate ?? null,
          created_by: input.createdBy,
        })
        .select("*")
        .single();
      if (error) throw error;
      return data as unknown as GroupTask;
    },
    onSuccess: (_r, v) => qc.invalidateQueries({ queryKey: ["group-tasks", v.groupId] }),
  });
}

export function useUpdateGroupTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      taskId: string;
      groupId: string;
      status?: GroupTaskStatus;
      assigneeId?: string | null;
      title?: string;
      description?: string | null;
      dueDate?: string | null;
    }) => {
      const patch: Partial<Database["public"]["Tables"]["group_tasks"]["Update"]> = {};
      if (input.status !== undefined) patch.status = input.status;
      if (input.assigneeId !== undefined) patch.assignee_id = input.assigneeId;
      if (input.title !== undefined) patch.title = input.title.trim();
      if (input.description !== undefined) patch.description = input.description;
      if (input.dueDate !== undefined) patch.due_date = input.dueDate;
      const { error } = await supabase.from("group_tasks").update(patch).eq("id", input.taskId);
      if (error) throw error;
    },
    onSuccess: (_r, v) => qc.invalidateQueries({ queryKey: ["group-tasks", v.groupId] }),
  });
}

export function useDeleteGroupTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { taskId: string; groupId: string }) => {
      const { error } = await supabase.from("group_tasks").delete().eq("id", input.taskId);
      if (error) throw error;
    },
    onSuccess: (_r, v) => qc.invalidateQueries({ queryKey: ["group-tasks", v.groupId] }),
  });
}
