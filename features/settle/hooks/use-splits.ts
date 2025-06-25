import { useMutation, useQueryClient } from "@tanstack/react-query";
import { settleDebt } from "../api/client";
import { QueryKeys } from "@/lib/constants";
import { useWallet } from "@/hooks/useWallet";
import { toast } from "sonner";

export const useSettleDebt = (groupId: string) => {
  const queryClient = useQueryClient();
  const { wallet } = useWallet();

  return useMutation({
    mutationFn: (payload: Parameters<typeof settleDebt>[0]) => {
      // Only require wallet for signing, not for creating
      return settleDebt(payload, wallet || undefined);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: [QueryKeys.GROUPS, groupId],
      });
      queryClient.invalidateQueries({
        queryKey: [QueryKeys.BALANCES],
      });
      queryClient.invalidateQueries({
        queryKey: [QueryKeys.FRIENDS],
      });
    },
    onError: (error: any) => {
      let errorMsg = "Unknown error";
      if (error && typeof error === "object") {
        if (Array.isArray(error.message)) {
          errorMsg = error.message.map((e: any) => e.message).join(", ");
        } else if (typeof error.message === "string") {
          errorMsg = error.message;
        } else if (error.data && error.data.error) {
          if (Array.isArray(error.data.error)) {
            errorMsg = error.data.error.map((e: any) => e.message || JSON.stringify(e)).join(", ");
          } else {
            errorMsg = error.data.error;
          }
        } else {
          errorMsg = JSON.stringify(error);
        }
      }
      toast.error("Error settling debt.", { description: errorMsg });
    },
  });
};
