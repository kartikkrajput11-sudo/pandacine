CREATE TYPE public.group_task_status AS ENUM ('pending', 'done', 'cancelled');

CREATE TABLE public.group_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  assignee_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.group_task_status NOT NULL DEFAULT 'pending',
  due_date date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_tasks TO authenticated;
GRANT ALL ON public.group_tasks TO service_role;

ALTER TABLE public.group_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members can view tasks"
  ON public.group_tasks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_group_members gm
      WHERE gm.group_id = group_tasks.group_id AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Group members can create tasks"
  ON public.group_tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.chat_group_members gm
      WHERE gm.group_id = group_tasks.group_id AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Task creator or admin can update tasks"
  ON public.group_tasks
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.chat_group_members gm
      WHERE gm.group_id = group_tasks.group_id AND gm.user_id = auth.uid() AND gm.role = 'admin'
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.chat_group_members gm
      WHERE gm.group_id = group_tasks.group_id AND gm.user_id = auth.uid() AND gm.role = 'admin'
    )
  );

CREATE POLICY "Task creator or admin can delete tasks"
  ON public.group_tasks
  FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.chat_group_members gm
      WHERE gm.group_id = group_tasks.group_id AND gm.user_id = auth.uid() AND gm.role = 'admin'
    )
  );

CREATE INDEX idx_group_tasks_group_id ON public.group_tasks(group_id);
CREATE INDEX idx_group_tasks_status ON public.group_tasks(status);