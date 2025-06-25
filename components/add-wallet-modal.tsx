"use client";

import { X, ChevronDown, Check, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { fadeIn, scaleIn } from "@/utils/animations";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  getAvailableChains,
  addMultichainAccount,
} from "@/services/walletService";
import {
  StellarWalletsKit,
  WalletNetwork,
  allowAllModules,
  XBULL_ID,
} from "@creit.tech/stellar-wallets-kit";
import {
  useAvailableChains,
  useAddWallet,
  useUserWallets,
  useSetWalletAsPrimary,
} from "@/features/wallets/hooks/use-wallets";
import {
  Wallet as WalletType,
  ChainResponse as ChainResponseType,
} from "@/features/wallets/api/client";

// Define wallet interface
interface Wallet {
  id: string;
  address: string;
  chain: string;
  isPrimary: boolean;
}

interface Chain {
  id: string;
  name: string;
  enabled: boolean;
}

interface ChainResponse {
  chains: Chain[];
}

interface AddWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Fallback chains in case API fails
const FALLBACK_CHAINS = [
  { id: "ethereum", name: "Ethereum", enabled: true },
  { id: "stellar", name: "Stellar", enabled: true },
  { id: "solana", name: "Solana", enabled: true },
  { id: "polygon", name: "Polygon", enabled: true },
  { id: "binance", name: "Binance", enabled: true },
];

// API URL for access to backend
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export const AddWalletModal = ({ isOpen, onClose }: AddWalletModalProps) => {
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [selectedChain, setSelectedChain] = useState<Chain | null>(null);
  const [step, setStep] = useState<"address" | "connecting">("address");
  const [primaryWalletExists, setPrimaryWalletExists] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);
  const walletKitRef = useRef<StellarWalletsKit | null>(null);

  // Fetch user's wallets and available chains
  const { data: walletsData } = useUserWallets();
  const { data: availableChains, isLoading: chainsLoading } =
    useAvailableChains();
  const wallets = walletsData?.accounts || [];

  // Add wallet mutation
  const { mutate: addWalletMutation, isPending: isAddingWallet } =
    useAddWallet();
  const { mutate: setPrimaryWallet, isPending: isSettingPrimary } =
    useSetWalletAsPrimary();

  // Process chains data
  const chains = availableChains?.chains || FALLBACK_CHAINS;

  // Initialize Stellar Wallets Kit
  useEffect(() => {
    if (!walletKitRef.current) {
      walletKitRef.current = new StellarWalletsKit({
        network: WalletNetwork.PUBLIC, // Use testnet for development, PUBLIC for production
        selectedWalletId: XBULL_ID, // Default selected wallet
        modules: allowAllModules(),
      });
    }

    return () => {
      // Cleanup if needed
      walletKitRef.current = null;
    };
  }, []);

  // Set initial chain when data is loaded
  useEffect(() => {
    if (chains.length > 0 && !selectedChain && isOpen) {
      setSelectedChain(chains[0]);
    }
  }, [chains, selectedChain, isOpen]);

  // Clear wallet address when chain changes
  useEffect(() => {
    setWalletAddress("");
  }, [selectedChain]);

  const handleSubmit = async () => {
    if (!walletAddress.trim()) {
      toast.error("Please enter a wallet address");
      return;
    }

    if (!selectedChain) {
      toast.error("Please select a blockchain");
      return;
    }

    // Basic client-side validation based on chain type
    if (selectedChain.id === "stellar") {
      // Stellar addresses should start with G and be 56 characters long
      // For Stellar: public keys are 56 chars and start with G
      if (!/^G[A-Z0-9]{55}$/.test(walletAddress)) {
        toast.error(
          "Invalid Stellar address format. Addresses should start with G and be 56 characters long."
        );
        return;
      }
    } else if (
      selectedChain.id === "ethereum" ||
      selectedChain.id === "polygon"
    ) {
      // Ethereum-compatible addresses are 42 characters including 0x prefix
      if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
        toast.error(
          "Invalid Ethereum address format. Addresses should start with 0x and be 42 characters long."
        );
        return;
      }
    } else if (selectedChain.id === "solana") {
      // Solana addresses are typically base58 encoded and 32-44 characters
      if (walletAddress.length < 32 || walletAddress.length > 44) {
        toast.error("Invalid Solana address format.");
        return;
      }
    }

    // Make sure we're using the exact chainId as expected by the backend
    // Use "xlm" when the selected chain is "stellar"
    const chainId = selectedChain.id;

    // Add the wallet using our mutation
    addWalletMutation(
      {
        chainId,
        address: walletAddress,
        isPrimary: false,
      },
      {
        onSuccess: () => {
          // Reset form
          setWalletAddress("");

          // Close modal
          onClose();
        },
      }
    );
  };

  // Function to handle chain selection
  const handleChainSelect = (chain: Chain) => {
    setSelectedChain(chain);
    setIsDropdownOpen(false);
  };

  // Get placeholder with the selected chain name
  const getPlaceholder = (): string => {
    const chainName =
      chains.find((c) => c.id === selectedChain?.id)?.name || "blockchain";
    return `Enter ${chainName} wallet address`;
  };

  // Find the currently selected chain
  const selectedChainObject = chains.find((c) => c.id === selectedChain?.id);

  // Handle connect wallet with Stellar Wallets Kit
  const handleConnectWallet = async () => {
    if (isConnectingWallet) return;

    setIsConnectingWallet(true);

    try {
      if (selectedChain?.id !== "stellar") {
        toast.error(
          "Web wallet connection only works with Stellar blockchain."
        );
        setIsConnectingWallet(false);
        return;
      }

      if (!walletKitRef.current) {
        toast.error("Wallet connection is not available");
        setIsConnectingWallet(false);
        return;
      }

      // Open wallet selection modal with callback for wallet selection
      await walletKitRef.current.openModal({
        onWalletSelected: async (selectedWallet) => {
          try {
            if (!selectedWallet) {
              console.log("No wallet selected");
              return;
            }

            if (!walletKitRef.current) return;

            walletKitRef.current.setWallet(selectedWallet.id);

            // Get wallet address
            const response = await walletKitRef.current.getAddress();
            const publicKey =
              typeof response === "object" && response !== null
                ? response.address
                : response;

            if (!publicKey || typeof publicKey !== "string") {
              toast.error("Failed to get wallet address. Please try again.");
              return;
            }

            try {
              // Add the wallet using our mutation hook
              addWalletMutation(
                {
                  chainId: "stellar", // Use 'stellar' for Stellar chain ID
                  address: publicKey,
                  isPrimary: false,
                },
                {
                  onSuccess: () => {
                    toast.success("Stellar wallet connected successfully!");
                    onClose();
                  },
                }
              );
            } catch (error) {
              console.error("Error adding wallet:", error);
              // Error is handled by addWallet function
            }
          } catch (error) {
            console.error("Error in wallet selection:", error);
            toast.error(
              error instanceof Error
                ? error.message
                : "Failed to connect wallet. Please try again."
            );
          } finally {
            setIsConnectingWallet(false);
          }
        },
      });
    } catch (error) {
      console.error("Error connecting wallet:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to connect wallet. Please try again."
      );
      setIsConnectingWallet(false);
    }
  };

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
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-[500px]">
            <motion.div
              className="relative z-10 rounded-3xl overflow-hidden"
              {...scaleIn}
            >
              <div className="flex flex-col bg-black rounded-3xl p-6 border border-white/80">
                {/* Modal Header */}
                <div className="w-full mb-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-semibold text-white">
                      Wallet
                    </h2>
                    <button
                      onClick={onClose}
                      className="rounded-full p-1.5 hover:bg-white/10 transition-colors"
                    >
                      <X className="h-5 w-5 text-white/70" />
                    </button>
                  </div>
                </div>

                {/* Modal Content */}
                <div className="space-y-6 mb-8">
                  {/* Wallet Address Input */}
                  <div className="space-y-2">
                    <label
                      htmlFor="wallet-address"
                      className="block text-white text-base"
                    >
                      Wallet Address
                    </label>
                    <input
                      id="wallet-address"
                      type="text"
                      value={walletAddress}
                      onChange={(e) => setWalletAddress(e.target.value)}
                      className="w-full bg-black border border-white/20 text-white p-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-white/30"
                      placeholder={getPlaceholder()}
                      disabled={isAddingWallet || isSettingPrimary}
                    />
                  </div>

                  {/* Wallet Chain Dropdown */}
                  <div className="space-y-2">
                    <label className="block text-white text-base">
                      Wallet Chain
                    </label>

                    {chainsLoading ? (
                      <div className="flex items-center p-3 text-white/70">
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                        <span>Loading blockchains...</span>
                      </div>
                    ) : (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                          className="w-full bg-black border border-[#2e2e31] text-white p-3 rounded-lg focus:outline-none focus:ring-1 focus:ring-white/30 flex items-center justify-between"
                          disabled={isAddingWallet || isSettingPrimary}
                        >
                          <span>
                            {selectedChain?.name || "Select blockchain"}
                          </span>
                          <ChevronDown
                            className={`h-5 w-5 text-white/70 transition-transform duration-200 ${
                              isDropdownOpen ? "rotate-180" : ""
                            }`}
                          />
                        </button>

                        {/* Dropdown */}
                        <AnimatePresence>
                          {isDropdownOpen && (
                            <motion.div
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              transition={{ duration: 0.15 }}
                              className="absolute left-0 right-0 mt-1 bg-black border border-[#2e2e31] rounded-lg overflow-hidden z-10 max-h-[250px] overflow-y-auto"
                            >
                              {chains.map((chain) => (
                                <button
                                  key={chain.id}
                                  type="button"
                                  onClick={() => handleChainSelect(chain)}
                                  className="w-full text-left px-4 py-3 text-white hover:bg-white/5 transition-colors flex items-center"
                                >
                                  <div className="w-5 h-5 flex items-center justify-center border border-white/30 rounded mr-3">
                                    {selectedChain?.id === chain.id && (
                                      <Check className="h-3.5 w-3.5 text-white" />
                                    )}
                                  </div>
                                  {chain.name}
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                </div>

                {/* Add Wallet Button */}
                <motion.button
                  onClick={handleSubmit}
                  disabled={isAddingWallet || isSettingPrimary || chainsLoading}
                  whileHover={{
                    scale: isAddingWallet || isSettingPrimary ? 1 : 1.02,
                  }}
                  whileTap={{
                    scale: isAddingWallet || isSettingPrimary ? 1 : 0.98,
                  }}
                  className="w-full h-[58px] flex items-center justify-center
                  bg-white rounded-full
                  text-lg font-semibold text-black
                  transition-all duration-200 hover:bg-white/90 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isAddingWallet || isSettingPrimary ? (
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-5 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
                      <span>Adding...</span>
                    </div>
                  ) : (
                    "Add Wallet"
                  )}
                </motion.button>

                {/* Connect Wallet Link */}
                <div className="mt-4 text-center">
                  <div className="flex items-center gap-2 my-2">
                    <div className="h-px bg-white/20 flex-grow"></div>
                    <span className="text-white/50 text-sm">OR</span>
                    <div className="h-px bg-white/20 flex-grow"></div>
                  </div>
                  <button
                    type="button"
                    className={`text-white transition-colors text-base flex items-center justify-center gap-2 w-full bg-transparent border py-3 rounded-full mt-2 ${
                      selectedChain?.id === "stellar"
                        ? "border-white/40 hover:bg-white/10"
                        : "border-white/10 cursor-not-allowed opacity-50"
                    }`}
                    onClick={handleConnectWallet}
                    disabled={isConnectingWallet}
                  >
                    {isConnectingWallet ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Connecting...</span>
                      </>
                    ) : (
                      <span>Connect Stellar Wallet</span>
                    )}
                  </button>
                  {selectedChain?.id !== "stellar" ? (
                    <p className="text-white/50 text-xs mt-2">
                      Web wallet connection only works with Stellar blockchain
                    </p>
                  ) : (
                    <p className="text-white/70 text-xs mt-2">
                      Connect with xBull, Lobstr, Freighter, and other Stellar
                      wallets
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};