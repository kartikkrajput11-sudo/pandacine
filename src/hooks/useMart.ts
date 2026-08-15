import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listMartOrders, martCheckout, respondToSplit } from "@/lib/mart.functions";
import type { CartLine, MartOrder } from "@/lib/mart";

/** Local, session-only shopping cart. */
export function useCart() {
  const [lines, setLines] = useState<CartLine[]>([]);

  const add = useCallback((line: Omit<CartLine, "qty">, qty = 1) => {
    setLines((prev) => {
      const i = prev.findIndex((l) => l.key === line.key && l.kind === line.kind);
      if (i === -1) return [...prev, { ...line, qty: line.kind === "boutique" ? 1 : qty }];
      if (line.kind === "boutique") return prev;
      const next = [...prev];
      next[i] = { ...next[i]!, qty: Math.min(10, next[i]!.qty + qty) };
      return next;
    });
  }, []);

  const setQty = useCallback((key: string, qty: number) => {
    setLines((prev) =>
      qty <= 0 ? prev.filter((l) => l.key !== key) : prev.map((l) => (l.key === key ? { ...l, qty: Math.min(10, qty) } : l)),
    );
  }, []);

  const remove = useCallback((key: string) => setLines((prev) => prev.filter((l) => l.key !== key)), []);
  const clear = useCallback(() => setLines([]), []);

  return { lines, add, setQty, remove, clear };
}

export function useMartOrders() {
  const fetchOrders = useServerFn(listMartOrders);
  return useQuery({
    queryKey: ["mart", "orders"],
    queryFn: async () => {
      const r = await fetchOrders({ data: undefined as never });
      return { orders: (r.orders ?? []) as MartOrder[], userId: r.userId as string };
    },
  });
}

export function useMartCheckout() {
  const qc = useQueryClient();
  const checkout = useServerFn(martCheckout);
  return useMutation({
    mutationFn: (input: { items: { kind: "food" | "boutique"; key: string; qty: number }[]; split: boolean; note?: string }) =>
      checkout({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mart"] });
      qc.invalidateQueries({ queryKey: ["luvies"] });
      qc.invalidateQueries({ queryKey: ["pet"] });
      qc.invalidateQueries({ queryKey: ["panda-shop"] });
      qc.invalidateQueries({ queryKey: ["profile", "me"] });
    },
    onError: (e: any) => toast.error(String(e?.message ?? "Checkout failed")),
  });
}

export function useSplitResponse() {
  const qc = useQueryClient();
  const respond = useServerFn(respondToSplit);
  return useMutation({
    mutationFn: (input: { orderId: string; accept: boolean }) => respond({ data: input }),
    onSuccess: (r: any) => {
      toast.success(r?.status === "accepted" ? "Your half is paid 💳" : "Split declined");
      qc.invalidateQueries({ queryKey: ["mart"] });
      qc.invalidateQueries({ queryKey: ["luvies"] });
    },
    onError: (e: any) => toast.error(String(e?.message ?? "Couldn't settle that")),
  });
}

/** Split bills waiting on this user. */
export function usePendingSplits() {
  const { data } = useMartOrders();
  return useMemo(
    () => (data?.orders ?? []).filter((o) => o.split_status === "pending" && o.partner_id === data?.userId),
    [data],
  );
}
