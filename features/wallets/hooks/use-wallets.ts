import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/authStore";
import { getUser } from "@/features/user/api/client";
import {
  addWallet,
  getAvailableChains,
  getUserWallets,
  Wallet,
  ChainResponse,
} from "../api/client";

// Query keys
export const WALLET_QUERY_KEYS = {
  WALLETS: "wallets",
  CHAINS: "chains",
};

// Hook to fetch all user's wallets
export const useUserWallets = () => {
  return useQuery<{ accounts: Wallet[] }>({
    queryKey: [WALLET_QUERY_KEYS.WALLETS],
    queryFn: getUserWallets,
    staleTime: 1000 * 60 * 5, // 5 minutes
    select: (data) => {
      // Handle cases where the API returns an object with accounts array
      // or fallback to the data itself if it's already the right structure
      return data || { accounts: [] };
    },
  });
};

// Hook to fetch available chains
export const useAvailableChains = () => {
  return useQuery<ChainResponse>({
    queryKey: [WALLET_QUERY_KEYS.CHAINS],
    queryFn: getAvailableChains,
  });
};

// Hook to add a wallet
export const useAddWallet = () => {
  const queryClient = useQueryClient();
  const { setUser } = useAuthStore();

  return useMutation({
    mutationFn: addWallet,
    onSuccess: async () => {
      toast.success("Wallet added successfully");
      await queryClient.invalidateQueries({ queryKey: [WALLET_QUERY_KEYS.WALLETS] });
      const user = await getUser();
      setUser(user);
    },
    onError: (error) => {
      console.error("Error adding wallet:", error);
      // Error is already handled and displayed by the addWallet function
    },
  });
};

// Hook to set a wallet as primary
export const useSetWalletAsPrimary = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      chainId,
      address,
    }: {
      chainId: string;
      address: string;
    }) => {
      return addWallet({ chainId, address, isPrimary: true });
    },
    onSuccess: () => {
      toast.success("Primary wallet updated");
      queryClient.invalidateQueries({ queryKey: [WALLET_QUERY_KEYS.WALLETS] });
    },
    onError: (error) => {
      console.error("Error setting primary wallet:", error);
      toast.error("Failed to update primary wallet");
    },
  });
};
