import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  LuviesWallet,
  PandaInventoryRow,
  PandaShopItem,
  StreakRecoveryState,
} from "@/lib/luvies";

const db = supabase as any;

/** Wallet: balance + lifetime earned/spent. Server is authoritative. */
export function useLuviesWallet() {
  return useQuery({
    queryKey: ["luvies", "wallet"],
    staleTime: 10_000,
    queryFn: async (): Promise<LuviesWallet> => {
      const { data, error } = await db.rpc("luvies_wallet");
      if (error) throw error;
      return (data as LuviesWallet) ?? { balance: 0, earned: 0, spent: 0 };
    },
  });
}

export function useLuviesHistory(limit = 60) {
  return useQuery({
    queryKey: ["luvies", "history", limit],
    queryFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) return [];
      const { data, error } = await db
        .from("coin_ledger")
        .select("id,delta,reason,ref_id,created_at")
        .eq("user_id", userRes.user.id)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as {
        id: string;
        delta: number;
        reason: string;
        ref_id: string | null;
        created_at: string;
      }[];
    },
  });
}

export function usePandaShop() {
  return useQuery({
    queryKey: ["panda-shop", "items"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<PandaShopItem[]> => {
      const { data, error } = await db
        .from("panda_shop_items")
        .select("id,item_key,category,name,emoji,description,price,rarity,sort_order")
        .eq("active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PandaShopItem[];
    },
  });
}

export function usePandaInventory() {
  return useQuery({
    queryKey: ["panda-shop", "inventory"],
    queryFn: async (): Promise<PandaInventoryRow[]> => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) return [];
      const { data, error } = await db
        .from("panda_inventory")
        .select("item_key,equipped,acquired_at")
        .eq("user_id", userRes.user.id)
        .order("acquired_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PandaInventoryRow[];
    },
  });
}

function cleanError(e: any): Error {
  const raw = String(e?.message ?? e ?? "Something went wrong");
  if (raw.includes("Not enough Luvies")) {
    const m = raw.match(/need (\d+), have (\d+)/);
    return new Error(m ? `Not enough Luvies — you need ${m[1]} and have ${m[2]}` : "Not enough Luvies");
  }
  if (raw.includes("duplicate key")) return new Error("You already own this item");
  return new Error(raw.replace(/^.*?ERROR:\s*/i, ""));
}

export function usePandaPurchase() {
  const qc = useQueryClient();
  return useMutation({
    // Backend verifies price, balance, ownership and atomically deducts.
    mutationFn: async (itemKey: string) => {
      const { data, error } = await db.rpc("buy_panda_item", { _item_key: itemKey });
      if (error) throw cleanError(error);
      return data as { balance: number; item_key: string; already_owned: boolean; price?: number };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["luvies"] });
      qc.invalidateQueries({ queryKey: ["panda-shop"] });
      qc.invalidateQueries({ queryKey: ["profile", "me"] });
    },
  });
}

export function usePandaEquip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemKey, equip }: { itemKey: string; equip: boolean }) => {
      const { data, error } = await db.rpc("equip_panda_item", { _item_key: itemKey, _equip: equip });
      if (error) throw cleanError(error);
      return data as { item_key: string; equipped: boolean };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["panda-shop", "inventory"] }),
  });
}

export function useStreakRecovery() {
  const qc = useQueryClient();

  const state = useQuery({
    queryKey: ["luvies", "streak-recovery"],
    staleTime: 30_000,
    queryFn: async (): Promise<StreakRecoveryState> => {
      const { data, error } = await db.rpc("streak_recovery_state");
      if (error) throw error;
      return (data as StreakRecoveryState) ?? { eligible: false, balance: 0 };
    },
  });

  const recover = useMutation({
    mutationFn: async () => {
      const { data, error } = await db.rpc("recover_streak");
      if (error) throw cleanError(error);
      return data as { balance: number; cost: number; restored_days: number; streak: number };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["luvies"] });
      qc.invalidateQueries({ queryKey: ["streak"] });
      qc.invalidateQueries({ queryKey: ["profile", "me"] });
    },
  });

  return { state, recover };
}
