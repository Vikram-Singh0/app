"use client";

import { X, Loader2, ChevronDown, MinusCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fadeIn, scaleIn } from "@/utils/animations";
import { toast } from "sonner";
import Image from "next/image";
import { GroupBalance, User } from "@/api-helpers/modelSchema";
import { useSettleDebt } from "@/features/settle/hooks/use-splits";
import { useHandleEscapeToCloseModal } from "@/hooks/useHandleEscape";
import { useQueryClient } from "@tanstack/react-query";
import { QueryKeys } from "@/lib/constants";
import { useGetFriends } from "@/features/friends/hooks/use-get-friends";
import { useGetAllGroups } from "@/features/groups/hooks/use-create-group";
import { useBalances } from "@/features/balances/hooks/use-balances";
import ResolverSelector, { Option as TokenOption } from "./ResolverSelector";
import { useOrganizedCurrencies } from "@/features/currencies/hooks/use-currencies";
import { useAuthStore } from "@/stores/authStore";
import { useWallet } from "@/hooks/useWallet";
import { useUserWallets } from "@/features/wallets/hooks/use-wallets";

// Define a type for friend data coming from the API
interface FriendWithBalances {
  id: string;
  name: string;
  email: string;
  image: string | null;
  balances: Array<{ currency: string; amount: number }>;
  stellarAccount?: string | null;
}

interface SettleDebtsModalProps {
  isOpen: boolean;
  onClose: () => void;
  balances?: GroupBalance[];
  groupId?: string;
  members?: User[];
  showIndividualView?: boolean;
  selectedFriendId?: string | null;
}

export function SettleDebtsModal({
  isOpen,
  onClose,
  balances = [],
  groupId = "",
  members = [],
  showIndividualView = false,
  selectedFriendId = null,
}: SettleDebtsModalProps) {
  const user = useAuthStore((state) => state.user);
  const {
    isConnected: walletConnected,
    isConnecting,
    connectWallet,
    wallet,
  } = useWallet();
  const [selectedToken, setSelectedToken] = useState<TokenOption | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [excludedFriendIds, setExcludedFriendIds] = useState<string[]>([]);
  const [totalAmount, setTotalAmount] = useState("0");
  const [individualAmount, setIndividualAmount] = useState("0");

  const settleDebtMutation = useSettleDebt(groupId);
  const queryClient = useQueryClient();
  const { data: friends } = useGetFriends();
  const { data: groups } = useGetAllGroups();
  const { data: balanceData } = useBalances();
  const { data: organizedCurrencies } = useOrganizedCurrencies();
  const { data: walletData } = useUserWallets();
  const wallets = walletData?.accounts || [];
  const stellarWallet = wallets.find(w => w.chainId === "stellar");
  const userStellarAddress = stellarWallet?.address || null;
  useHandleEscapeToCloseModal(isOpen, onClose);

  // Debug: Log user data
  useEffect(() => {
    console.log("[SettleDebtsModal] User data debug:", {
      user: user ? {
        id: user.id,
        name: user.name,
        stellarAccount: user.stellarAccount,
        hasStellarAccount: !!user.stellarAccount
      } : null,
      userStellarAddress,
      userFromStore: user
    });
  }, [user, userStellarAddress]);

  // Reset excluded friends when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      console.log("[SettleDebtsModal] Modal opened", { 
        groupId, 
        showIndividualView, 
        selectedFriendId,
        userStellarAddress
      });
      setExcludedFriendIds([]);
    }
  }, [isOpen, groupId, showIndividualView, selectedFriendId, userStellarAddress]);

  // Set the selected user based on selectedFriendId prop
  useEffect(() => {
    if (selectedFriendId && friends) {
      const friend = friends.find((friend) => friend.id === selectedFriendId);
      if (friend) {
        setSelectedUser(friend as unknown as User);

        // Calculate amount owed to this specific friend
        const positiveBalance = friend.balances.find((b) => b.amount > 0);
        if (positiveBalance) {
          setIndividualAmount(positiveBalance.amount.toFixed(2));
        } else {
          setIndividualAmount("0");
        }
      }
    } else if (!showIndividualView) {
      setSelectedUser(null);
    }
  }, [selectedFriendId, friends, showIndividualView]);

  // Calculate total debts across all groups on mount and when data changes
  useEffect(() => {
    if (friends) {
      const totalOwed = calculateTotalDebts(friends as FriendWithBalances[]);
      setTotalAmount(totalOwed.toFixed(2));
    }
  }, [friends, balanceData]);

  // Fetch available tokens
  useEffect(() => {
    if (isOpen && organizedCurrencies) {
      // Pick the first chain token as default
      const chainCurrencies = Object.values(organizedCurrencies.chainGroups || {}).flat();
      if (chainCurrencies.length > 0) {
        setSelectedToken({
          id: chainCurrencies[0].id,
          symbol: chainCurrencies[0].symbol,
          name: chainCurrencies[0].name,
          chainId: chainCurrencies[0].chainId || undefined,
          type: chainCurrencies[0].type,
        });
      }
    }
  }, [isOpen, organizedCurrencies]);

  // Update individualAmount when selectedUser changes
  useEffect(() => {
    if (selectedUser) {
      const positiveBalance = (selectedUser as any).balances?.find((b: any) => b.amount > 0);
      if (positiveBalance) {
        setIndividualAmount(positiveBalance.amount.toFixed(2));
      } else {
        setIndividualAmount("0");
      }
    }
  }, [selectedUser]);

  // Function to calculate total debts owed to all friends
  const calculateTotalDebts = (friendsList: FriendWithBalances[]) => {
    return friendsList.reduce((total, friend) => {
      const positiveBalances = friend.balances.filter((b) => b.amount > 0);
      const friendTotal = positiveBalances.reduce((sum: number, balance) => {
        return sum + balance.amount;
      }, 0);
      return total + friendTotal;
    }, 0);
  };

  // Calculate remaining total after excluding friends
  const calculateRemainingTotal = () => {
    if (!friends) return 0;

    const includedFriends = friends.filter(
      (friend) => !excludedFriendIds.includes(friend.id)
    );
    return calculateTotalDebts(includedFriends as FriendWithBalances[]);
  };

  // Toggle excluding a friend from settlement
  const toggleExcludeFriend = (friendId: string) => {
    setExcludedFriendIds((prev) => {
      if (prev.includes(friendId)) {
        return prev.filter((id) => id !== friendId);
      } else {
        return [...prev, friendId];
      }
    });
  };

  // Get friends with debts for showing in the modal
  const friendsWithDebts =
    friends?.filter((friend) =>
      friend.balances.some((balance) => balance.amount > 0)
    ) || [];

  const handleSettleOne = async (settleWith: User) => {
    if (!wallet) {
      toast.error("Please connect your wallet to sign the transaction.");
      connectWallet(); // Open the wallet modal
      return;
    }
    
    if (!userStellarAddress) {
      toast.error("Please add your Stellar wallet address in settings first.");
      return;
    }
    
    console.log("[SettleDebtsModal] Settle One clicked", { settleWith });
    console.log("[SettleDebtsModal] User data:", { 
      userStellarAddress
    });
    
    if (!selectedToken) {
      toast.error("Please select a payment token");
      return;
    }

    const payload = {
      groupId,
      address: userStellarAddress, // Use the stored address from database
      settleWithId: settleWith.id,
      selectedTokenId: selectedToken.id,
      selectedChainId: selectedToken.chainId,
      amount: parseFloat(individualAmount),
    };
    console.log("[SettleDebtsModal] Calling settleDebtMutation.mutate (one)", payload);
    settleDebtMutation.mutate(payload, {
      onSuccess: () => {
        console.log("[SettleDebtsModal] Settle One success");
        toast.success(`Successfully settled debt with ${settleWith.name}`);
        onClose();
      },
      onError: (err) => {
        console.error("[SettleDebtsModal] Settle One error", err);
        toast.error("Failed to settle debt", {
          description: "Please try again or check your wallet connection.",
        });
      }
    });
  };

  const handleSettleAll = async () => {
    if (!wallet || !userStellarAddress) {
      toast.error("Please connect your wallet to sign the transaction.");
      connectWallet();
      return;
    }
    if (!selectedToken) {
      toast.error("Please select a payment token");
      return;
    }

    // Create a payload that matches the expected structure by the API
    const payload = {
      groupId,
      address: userStellarAddress,
      selectedTokenId: selectedToken.id,
      selectedChainId: selectedToken.chainId,
      amount: parseFloat(totalAmount), // or remainingTotal if that's the correct value
    };
    settleDebtMutation.mutate(payload, {
      onSuccess: () => {
        onClose();
        toast.success("Successfully settled debts");
      },
      onError: (err) => {
        toast.error("Failed to settle debts", {
          description: "Please try again or check your wallet connection.",
        });
      }
    });
  };

  const isPending = settleDebtMutation.isPending;

  // Get the selected user's balance for individual settlement
  const selectedUserBalance = selectedUser
    ? (selectedUser as unknown as FriendWithBalances).balances.find(
        (balance) => balance.amount > 0
      )?.amount || 0
    : 0;

  // Calculate the remaining total after exclusions
  const remainingTotal = calculateRemainingTotal();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 h-screen w-screen"
          {...fadeIn}
        >
          <motion.div
            className="fixed inset-0 bg-black/70 brightness-50"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full md:w-[90%] max-w-[600px] px-4 sm:px-0">
            {/* Settle All Debts Section - Only shown when header button is clicked */}
            {!showIndividualView && (
              <motion.div
                className="relative z-10 rounded-[24px] bg-black p-5 sm:p-8 border border-white/10 shadow-[0_0_15px_rgba(255,255,255,0.05)]"
                {...scaleIn}
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="mb-1 text-xs sm:text-sm text-white/60">
                      Settle All Debt
                    </div>
                    <h2 className="text-xl sm:text-3xl font-semibold text-white">
                      Settle All Debts
                    </h2>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 rounded-full hover:bg-white/[0.03] transition-colors"
                  >
                    <X className="h-5 w-5 text-white/60" />
                  </button>
                </div>

                <div className="space-y-4 sm:space-y-6">
                  {/* Show user's stored Stellar address */}
                  {userStellarAddress ? (
                    <div className="text-sm text-white/70">
                      Using address: {userStellarAddress.slice(0, 25)}...
                    </div>
                  ) : (
                    <div className="text-sm text-red-400">
                      Please add your Stellar wallet address in settings first.
                    </div>
                  )}

                  <div>
                    <div className="text-base sm:text-lg font-medium text-white mb-3 sm:mb-4">
                      Choose Payment Token
                    </div>

                    <div className="relative mb-3 sm:mb-4">
                      <button className="w-full flex items-center justify-between rounded-full h-12 sm:h-14 px-4 sm:px-6 bg-transparent border border-white/10 text-white">
                        <span className="text-base sm:text-lg">
                          {selectedToken?.symbol || "Token"}
                        </span>
                        <ChevronDown className="h-4 w-4 sm:h-5 sm:w-5 text-white/50" />
                      </button>
                    </div>

                    <div className="relative">
                      <div className="w-full flex items-center justify-between rounded-full h-12 sm:h-14 px-4 sm:px-6 bg-transparent border border-white/10 text-white">
                        <input
                          type="text"
                          value={remainingTotal.toFixed(2)}
                          onChange={(e) => setTotalAmount(e.target.value)}
                          className="bg-transparent outline-none text-base sm:text-lg w-full"
                        />
                        <span className="text-base sm:text-lg text-white/50">
                          {selectedToken?.symbol || "Token"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 sm:space-y-5 max-h-[200px] sm:max-h-[300px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                    {friendsWithDebts
                      .filter((friend) =>
                        friend.balances.some((b) => b.amount > 0)
                      )
                      .map((friend, index) => {
                        const positiveBalance = friend.balances.find(
                          (b) => b.amount > 0
                        );
                        const amount = positiveBalance
                          ? positiveBalance.amount
                          : 0;
                        const isExcluded = excludedFriendIds.includes(
                          friend.id
                        );

                        return (
                          <div
                            key={index}
                            className={`flex items-center justify-between ${
                              isExcluded ? "opacity-50" : ""
                            }`}
                          >
                            <div className="flex items-center gap-3 sm:gap-4">
                              <div className="h-10 w-10 sm:h-12 sm:w-12 overflow-hidden rounded-full">
                                <Image
                                  src={
                                    friend.image ||
                                    `https://api.dicebear.com/9.x/identicon/svg?seed=${friend.id}`
                                  }
                                  alt={friend.name || "User"}
                                  width={48}
                                  height={48}
                                  className="h-full w-full object-cover"
                                  onError={(e) => {
                                    // Fallback to dicebear
                                    const target = e.target as HTMLImageElement;
                                    target.src = `https://api.dicebear.com/9.x/identicon/svg?seed=${friend.id}`;
                                  }}
                                />
                              </div>
                              <div>
                                <p className="text-mobile-base sm:text-xl text-white font-medium">
                                  {friend.name}
                                </p>
                                <p className="text-mobile-sm sm:text-base text-white/60">
                                  You owe{" "}
                                  <span className="text-[#FF4444]">
                                    ${amount.toFixed(2)}
                                  </span>
                                </p>
                              </div>
                            </div>

                            <button
                              className={`flex items-center justify-center h-8 w-8 sm:h-10 sm:w-10 rounded-full border border-white/10 hover:bg-white/5 transition-colors ${
                                isExcluded ? "bg-white/5" : ""
                              }`}
                              onClick={() => toggleExcludeFriend(friend.id)}
                              title={
                                isExcluded
                                  ? "Include in settlement"
                                  : "Exclude from settlement"
                              }
                            >
                              <MinusCircle
                                className={`h-4 w-4 sm:h-5 sm:w-5 text-white ${
                                  isExcluded ? "text-red-500" : "text-white/70"
                                }`}
                              />
                            </button>
                          </div>
                        );
                      })}

                    {friendsWithDebts.filter((friend) =>
                      friend.balances.some((b) => b.amount > 0)
                    ).length === 0 && (
                      <div className="text-center text-white/60 py-4 text-mobile-sm sm:text-base">
                        No debts to settle
                      </div>
                    )}
                  </div>
                </div>

                <button
                  className="w-full mt-8 sm:mt-12 flex items-center justify-center gap-2 text-mobile-base sm:text-lg font-medium h-10 sm:h-14 bg-white text-black rounded-full hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => {
                    console.log("[SettleDebtsModal] Settle All button clicked", { isPending, remainingTotal, friendsWithDebtsLength: friendsWithDebts.length });
                    handleSettleAll();
                  }}
                  disabled={
                    isPending ||
                    remainingTotal <= 0 ||
                    friendsWithDebts.length === 0 ||
                    !userStellarAddress
                  }
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                      <span>Settling payment...</span>
                    </>
                  ) : (
                    <>
                      <Image
                        src="/coins-dollar.svg"
                        alt="Settle Payment"
                        width={24}
                        height={24}
                        className="invert h-4 w-4 sm:h-5 sm:w-5"
                      />
                      <span>Settle Payment</span>
                    </>
                  )}
                </button>
              </motion.div>
            )}

            {/* Settle Individual Debt Section - Only shown when a friend's button is clicked */}
            {showIndividualView && (
              <motion.div
                className="relative z-10 rounded-[24px] bg-black p-5 sm:p-8 border border-white/10 shadow-[0_0_15px_rgba(255,255,255,0.05)]"
                {...scaleIn}
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="mb-1 text-xs sm:text-sm text-white/60">
                      Settle Individual Debt
                    </div>
                    <h2 className="text-xl sm:text-3xl font-semibold text-white">
                      {selectedUser
                        ? `Settle ${selectedUser.name}'s Debts`
                        : "Settle Individual Debt"}
                    </h2>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 rounded-full hover:bg-white/[0.03] transition-colors"
                  >
                    <X className="h-5 w-5 text-white/60" />
                  </button>
                </div>

                <div className="space-y-4 sm:space-y-6">
                  <div>
                    <div className="text-base sm:text-lg font-medium text-white mb-3 sm:mb-4">
                      Choose Payment Token
                    </div>

                    <div className="relative mb-3 sm:mb-4">
                      <ResolverSelector
                        value={selectedToken || undefined}
                        onChange={(option) => setSelectedToken(option || null)}
                      />
                    </div>

                    <div className="relative">
                      <div className="w-full flex items-center justify-between rounded-full h-12 sm:h-14 px-4 sm:px-6 bg-transparent border border-white/10 text-white">
                        <input
                          type="text"
                          value={individualAmount}
                          onChange={(e) => setIndividualAmount(e.target.value)}
                          className="bg-transparent outline-none text-base sm:text-lg w-full"
                        />
                        <span className="text-base sm:text-lg text-white/50">
                          {selectedToken?.symbol || "Token"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {!selectedUser && (
                    <div className="text-center text-white/60 py-4 text-mobile-sm sm:text-base">
                      Select a user to settle individual debt
                    </div>
                  )}

                  {selectedUser && (
                    <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-white/5 rounded-xl">
                      <div className="h-10 w-10 sm:h-14 sm:w-14 overflow-hidden rounded-full">
                        <Image
                          src={
                            selectedUser.image ||
                            `https://api.dicebear.com/9.x/identicon/svg?seed=${selectedUser.id}`
                          }
                          alt={selectedUser.name || "User"}
                          width={56}
                          height={56}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            // Fallback to dicebear
                            const target = e.target as HTMLImageElement;
                            target.src = `https://api.dicebear.com/9.x/identicon/svg?seed=${selectedUser.id}`;
                          }}
                        />
                      </div>
                      <div>
                        <p className="text-mobile-base sm:text-xl text-white font-medium">
                          {selectedUser.name}
                        </p>
                        <p className="text-mobile-sm sm:text-base text-white/60">
                          You owe{" "}
                          <span className="text-[#FF4444]">
                            ${Math.abs(selectedUserBalance).toFixed(2)}
                          </span>
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  className="w-full mt-8 sm:mt-12 flex items-center justify-center gap-2 text-mobile-base sm:text-lg font-medium h-10 sm:h-14 bg-white text-black rounded-full hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => selectedUser && handleSettleOne(selectedUser)}
                  disabled={
                    isPending ||
                    !selectedUser ||
                    parseFloat(individualAmount) <= 0 ||
                    !selectedToken ||
                    !userStellarAddress
                  }
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                      <span>Settling payment...</span>
                    </>
                  ) : (
                    <>
                      <Image
                        src="/coins-dollar.svg"
                        alt="Settle Payment"
                        width={24}
                        height={24}
                        className="invert h-4 w-4 sm:h-5 sm:w-5"
                      />
                      <span>Settle Payment</span>
                    </>
                  )}
                </button>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
