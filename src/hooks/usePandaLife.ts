import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

export const BOND_COST = 999;

export type PetMemorial = {
  id: string;
  name: string;
  costume: string | null;
  born_at: string;
  died_at: string;
  death_reason: string;
  affection: number;
  interactions: number;
  streak: number;
  days_lived: number;
};

/** Every panda that came before — birthday, farewell, reason and bond. */
export function usePetMemorials() {
  return useQuery({
    queryKey: ["pet", "memorials"],
    queryFn: async (): Promise<PetMemorial[]> => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) return [];
      const { data, error } = await db
        .from("pet_memorials")
        .select("id,name,costume,born_at,died_at,death_reason,affection,interactions,streak,days_lived")
        .eq("user_id", userRes.user.id)
        .order("died_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PetMemorial[];
    },
  });
}

/** Whether this couple already merged their pandas into one shared pet. */
export function usePetBond() {
  return useQuery({
    queryKey: ["pet", "bond"],
    queryFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) return null;
      const uid = userRes.user.id;
      const { data } = await db
        .from("pet_bonds")
        .select("id,user_a,user_b,owner_user,created_at")
        .or(`user_a.eq.${uid},user_b.eq.${uid}`)
        .maybeSingle();
      return (data as { id: string; owner_user: string; created_at: string } | null) ?? null;
    },
  });
}

function clean(e: any) {
  return new Error(String(e?.message ?? e).replace(/^.*ERROR:\s*/i, ""));
}

export function usePetLifeActions() {
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["pet"] });
    qc.invalidateQueries({ queryKey: ["luvies"] });
  };

  // A panda that has died stays dead. The only way forward is an explicit,
  // separate purchase of a brand-new panda (see useBirthNewPanda).
  const birth = useMutation({
    mutationFn: async (name?: string) => {
      const { birthNewPanda } = await import("@/lib/pet.functions");
      return birthNewPanda({ data: { name } });
    },
    onSuccess: () => {
      toast.success("A new panda opens their eyes 🐼");
      refresh();
      qc.invalidateQueries({ queryKey: ["pet", "memorials"] });
    },
    onError: (e: any) => toast.error(String(e?.message ?? e)),
  });

  const bond = useMutation({
    mutationFn: async () => {
      const { data, error } = await db.rpc("bond_pet");
      if (error) throw clean(error);
      return data as { bond_id: string; already?: boolean };
    },
    onSuccess: () => {
      toast.success("Your pandas are one — you both care for them now");
      refresh();
      qc.invalidateQueries({ queryKey: ["pet", "bond"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return { revive, retire, bond };
}
