"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { useWallet } from "@/hooks/useWallet";
import { DetailGroup } from "@/features/groups/api/client";
import { Loader2, CreditCard, Wallet, Settings } from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { QueryKeys } from "@/lib/constants";
import { useAuthStore } from "@/stores/authStore";
import { formatCurrency } from "@/utils/formatters";

export function GroupInfoHeader({
  groupId,
  onSettleClick,
  group,
  onAddExpenseClick,
  onSettingsClick,
}: {
  groupId: string;
  onSettleClick: () => void;
  group: DetailGroup;
  onAddExpenseClick: () => void;
  onSettingsClick: () => void;
}) {
  const router = useRouter();
  const { address } = useWallet();
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [isSettling, setIsSettling] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  if (!group) return null;

  // Calculate balances by currency for the current user
  const getBalancesByCurrency = () => {
    const userBalances = group.groupBalances.filter(
      (balance) => balance.userId === user?.id
    );
    // Group by currency
    const currencyMap: Record<string, number> = {};
    userBalances.forEach((balance) => {
      if (!currencyMap[balance.currency]) {
        currencyMap[balance.currency] = 0;
      }
      currencyMap[balance.currency] += balance.amount;
    });
    return currencyMap;
  };

  const balancesByCurrency = getBalancesByCurrency();
  // Split into positive (owed to user) and negative (user owes)
  const owed: { currency: string; amount: number }[] = [];
  const owe: { currency: string; amount: number }[] = [];
  Object.entries(balancesByCurrency).forEach(([currency, amount]) => {
    if (amount > 0) {
      owed.push({ currency, amount });
    } else if (amount < 0) {
      owe.push({ currency, amount: Math.abs(amount) });
    }
  });

  const handleAddExpenseClick = () => {
    setIsAddingExpense(true);
    onAddExpenseClick();
    // Reset state after a delay to handle animation
    setTimeout(() => setIsAddingExpense(false), 500);
  };

  const handleSettleClick = () => {
    setIsSettling(true);
    onSettleClick();

    // Refetch data after settling debts
    setTimeout(() => {
      // refetch the specific group data
      queryClient.invalidateQueries({ queryKey: [QueryKeys.GROUPS, groupId] });

      // refetch the general groups list and balances
      queryClient.invalidateQueries({ queryKey: [QueryKeys.GROUPS] });
      queryClient.invalidateQueries({ queryKey: [QueryKeys.BALANCES] });

      setIsSettling(false);
    }, 500);
  };

  return (
    <div className="mb-6">
      <div className="flex justify-between items-start">
        {/* Group Info */}
        <div className="flex-1 min-w-0 pr-2">
          <h1 className="text-xl sm:text-2xl font-semibold text-white mb-1 truncate">
            {group.name}
          </h1>
          <p className="text-mobile-base sm:text-lg text-white/70">
            {owed.length > 0 ? (
              <>
                Overall, you are owed {" "}
                <span className="text-[#FF4444]">
                  {owed
                    .map((b) => formatCurrency(b.amount, b.currency))
                    .join(", ")}
                </span>
              </>
            ) : owe.length > 0 ? (
              <>
                Overall, you owe {" "}
                <span className="text-[#53e45d]">
                  {owe
                    .map((b) => formatCurrency(b.amount, b.currency))
                    .join(", ")}
                </span>
              </>
            ) : (
              <>You're all settled up!</>
            )}
          </p>
        </div>

        {/* 2x2 Button Grid for Mobile / Row for Desktop */}
        <div className="sm:hidden flex gap-3 flex-shrink-0">
          {/* Left Column - Action Buttons */}
          <div className="flex flex-col gap-2">
            <button
              onClick={handleAddExpenseClick}
              disabled={isAddingExpense}
              className="flex h-10 items-center justify-center gap-1 rounded-full bg-white text-black px-4 text-mobile-sm font-medium hover:bg-white/90 transition-all disabled:opacity-70 disabled:cursor-not-allowed truncate"
            >
              {isAddingExpense ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                  <span className="truncate">Adding...</span>
                </>
              ) : (
                <>
                  <Image
                    src="/plus-sign-circle.svg"
                    alt="Add Expense"
                    width={20}
                    height={20}
                    className="invert h-4 w-4 flex-shrink-0"
                  />
                  <span className="truncate">Add Expense</span>
                </>
              )}
            </button>

            <button
              onClick={handleSettleClick}
              disabled={isSettling}
              className="flex h-10 items-center justify-center gap-1 rounded-full border border-white/80 bg-transparent px-4 text-mobile-sm font-medium text-white hover:bg-white/5 transition-all disabled:opacity-70 disabled:cursor-not-allowed truncate"
            >
              {isSettling ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                  <span className="truncate">Settling...</span>
                </>
              ) : (
                <>
                  <Image
                    src="/coins-dollar.svg"
                    alt="Settle Debts"
                    width={20}
                    height={20}
                    className="h-4 w-4 flex-shrink-0"
                  />
                  <span className="truncate">Settle all debts</span>
                </>
              )}
            </button>
          </div>

          {/* Right Column - Profile and Settings */}
          <div className="flex flex-col gap-2">
            <div className="h-10 w-10 overflow-hidden rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 p-0.5">
              <div className="h-full w-full rounded-full overflow-hidden bg-[#101012]">
                {user?.image ? (
                  <Image
                    src={user.image}
                    alt="Profile"
                    width={48}
                    height={48}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Image
                    src={`https://api.dicebear.com/9.x/identicon/svg?seed=${
                      user?.id || user?.email || "user"
                    }`}
                    alt="Profile"
                    width={48}
                    height={48}
                    className="h-full w-full"
                    onError={(e) => {
                      console.error(`Error loading identicon for user`);
                      const target = e.target as HTMLImageElement;
                      target.src = `https://api.dicebear.com/9.x/identicon/svg?seed=user`;
                    }}
                  />
                )}
              </div>
            </div>

            <button
              onClick={onSettingsClick}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/80 bg-transparent text-white hover:bg-white/5 transition-all"
              aria-label="Group Settings"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Horizontal layout for desktop */}
        <div className="hidden sm:flex items-center gap-3">
          <button
            onClick={onSettingsClick}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-white/80 bg-transparent text-white hover:bg-white/5 transition-all"
            aria-label="Group Settings"
          >
            <Settings className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={handleAddExpenseClick}
              disabled={isAddingExpense}
              className="flex h-12 items-center justify-center gap-2 rounded-full bg-white text-black px-5 text-base font-medium hover:bg-white/90 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isAddingExpense ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Adding...</span>
                </>
              ) : (
                <>
                  <Image
                    src="/plus-sign-circle.svg"
                    alt="Add Expense"
                    width={20}
                    height={20}
                    className="invert h-5 w-5"
                  />
                  <span>Add Expense</span>
                </>
              )}
            </button>

            <button
              onClick={handleSettleClick}
              disabled={isSettling}
              className="flex h-12 items-center justify-center gap-2 rounded-full border border-white/80 bg-transparent px-5 text-base font-medium text-white hover:bg-white/5 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSettling ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Settling...</span>
                </>
              ) : (
                <>
                  <Image
                    src="/coins-dollar.svg"
                    alt="Settle Debts"
                    width={20}
                    height={20}
                    className="h-5 w-5"
                  />
                  <span>Settle all debts</span>
                </>
              )}
            </button>

            <div className="h-12 w-12 overflow-hidden rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 p-0.5">
              <div className="h-full w-full rounded-full overflow-hidden bg-[#101012]">
                {user?.image ? (
                  <Image
                    src={user.image}
                    alt="Profile"
                    width={48}
                    height={48}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Image
                    src={`https://api.dicebear.com/9.x/identicon/svg?seed=${
                      user?.id || user?.email || "user"
                    }`}
                    alt="Profile"
                    width={48}
                    height={48}
                    className="h-full w-full"
                    onError={(e) => {
                      console.error(`Error loading identicon for user`);
                      const target = e.target as HTMLImageElement;
                      target.src = `https://api.dicebear.com/9.x/identicon/svg?seed=user`;
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
