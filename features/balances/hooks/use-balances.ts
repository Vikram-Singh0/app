import { useQuery } from "@tanstack/react-query";
import { getBalances } from "../api/client";
import { QueryKeys } from "@/lib/constants";

export const useBalances = () => {
  return useQuery({
    queryKey: [QueryKeys.BALANCES],
    queryFn: getBalances,
    staleTime: 1000 * 30, // 30 seconds - reduced from 5 minutes for better freshness
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
};
