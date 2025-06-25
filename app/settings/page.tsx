"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import {
  Loader2,
  Trash2,
  LogOut,
  Minus,
  Save,
  ChevronDown,
  Check,
  Info,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { fadeIn } from "@/utils/animations";
import { toast } from "sonner";
import { signOut } from "@/lib/auth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AddWalletModal } from "@/components/add-wallet-modal";
import { useUpdateUser } from "@/features/user/hooks/use-update-profile";
import { asEnhancedUser } from "@/types/user";
import {
  useGetAllCurrencies,
  useOrganizedCurrencies,
} from "@/features/currencies/hooks/use-currencies";
import {
  useUserWallets,
  useAddWallet,
  useSetWalletAsPrimary,
} from "@/features/wallets/hooks/use-wallets";
import CurrencyDropdown from "@/components/currency-dropdown";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getUser } from "@/features/user/api/client";

// Base API URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface UserUpdateData {
  name?: string;
  preferredCurrency?: string;
  [key: string]: string | undefined;
}

export default function SettingsPage() {
  const { isAuthenticated, isLoading, user, setUser } = useAuthStore();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { mutate: updateUser } = useUpdateUser();

  // State for user settings
  const [displayName, setDisplayName] = useState<string>("");
  const [preferredCurrency, setPreferredCurrency] = useState<string>("");
  const [initialDisplayName, setInitialDisplayName] = useState<string>("");
  const [initialPreferredCurrency, setInitialPreferredCurrency] =
    useState<string>("");
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [selectedChainFilter, setSelectedChainFilter] =
    useState<string>("All Chains");

  const [selectedCurrencies, setSelectedCurrencies] = useState<string[]>([]);

  // State for wallets
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);

  // Use TanStack Query for API calls
  const { data: currencyData, isLoading: isLoadingCurrencies } =
    useGetAllCurrencies();
  const { data: organizedCurrencies } = useOrganizedCurrencies();

  // Use our wallet hooks
  const { data: walletData, isLoading: isLoadingWallets } = useUserWallets();
  const { mutate: addWallet, isPending: isAddingWallet } = useAddWallet();
  const { mutate: setWalletAsPrimary } = useSetWalletAsPrimary();

  const handleWalletAdded = async () => {
    try {
      const updatedUser = await getUser();
      if (updatedUser) {
        setUser(updatedUser);
        console.log("User profile updated in auth store after adding wallet.");
      }
    } catch (error) {
      console.error("Failed to refetch user after adding wallet", error);
      toast.error("Could not refresh user data. Please reload the page.");
    }
  };

  // Process wallet data for UI
  const wallets = walletData?.accounts || [];

  // Get all currencies from the API response
  const currencies = currencyData?.currencies || [];

  // Separate currencies by type for UI organization
  const fiatCurrencies = currencies.filter((c) => c.type === "FIAT");
  const cryptoCurrencies = currencies.filter((c) => c.type !== "FIAT");

  // State for chain tokens (retain for compatibility)
  const [chainTokens, setChainTokens] = useState<Record<string, any>>({});
  const [isLoadingTokens, setIsLoadingTokens] = useState<
    Record<string, boolean>
  >({});

  // Check if user has made changes to their profile
  const hasChanges =
    displayName !== initialDisplayName ||
    preferredCurrency !== initialPreferredCurrency;

  // Fetch tokens for a specific chain (retain for compatibility)
  const fetchTokensForChain = async (chainId: string) => {
    setIsLoadingTokens((prev) => ({ ...prev, [chainId]: true }));
    try {
      // We no longer need to fetch tokens separately, as they're included in the currencies response
      // But keep this method for compatibility with existing code
      const filteredTokens = currencies.filter((c) => c.chainId === chainId);
      setChainTokens((prev) => ({
        ...prev,
        [chainId]: filteredTokens,
      }));
    } catch (error) {
      console.error(`Error processing tokens for chain ${chainId}:`, error);
    } finally {
      setIsLoadingTokens((prev) => ({ ...prev, [chainId]: false }));
    }
  };

  // Load user data when available
  useEffect(() => {
    if (user) {
      const enhancedUser = asEnhancedUser(user);
      const name = enhancedUser.name || "";
      const currency = enhancedUser.currency || "USD"; // Default to USD instead of USDT

      setDisplayName(name);
      setPreferredCurrency(currency);

      // Also store initial values for comparison
      setInitialDisplayName(name);
      setInitialPreferredCurrency(currency);
    }
  }, [user]);

  // useEffect(() => {
  //   if (!isLoading && !isAuthenticated) {
  //     router.push("/login");
  //   }
  // }, [isLoading, isAuthenticated, router]);

  // Handle save changes
  const handleSaveChanges = async () => {
    if (!hasChanges) return;

    setIsSaving(true);

    try {
      // Prepare update data
      const updateData: UserUpdateData = {};

      if (displayName !== initialDisplayName) {
        updateData.name = displayName;
      }

      if (preferredCurrency !== initialPreferredCurrency) {
        updateData.preferredCurrency = preferredCurrency;
      }

      // Call update API
      updateUser(updateData, {
        onSuccess: () => {
          // Update initial values to match current values
          setInitialDisplayName(displayName);
          setInitialPreferredCurrency(preferredCurrency);

          toast.success("Profile updated successfully");
        },
        onError: (error) => {
          toast.error("Failed to update profile");
          console.error("Error updating profile:", error);
        },
      });
    } catch (error) {
      toast.error("Failed to update profile");
      console.error("Error updating profile:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Logout handler
  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await signOut();
      // Clear the user from the store
      setUser(null);
      toast.success("Logged out successfully");
      router.push("/login");
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Failed to log out. Please try again.");
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Set a wallet as primary using the mutation hook
  const handleSetAsPrimary = (walletId: string) => {
    const walletToUpdate = wallets.find((w) => w.id === walletId);
    if (!walletToUpdate) return;

    setWalletAsPrimary({
      chainId: walletToUpdate.chainId,
      address: walletToUpdate.address,
    });
  };

  // Remove a wallet
  const removeWallet = async (walletId: string) => {
    try {
      // In a full implementation, we would call an API to remove the wallet
      // For now, just show a toast since we haven't implemented the delete endpoint
      toast.error("Wallet removal not implemented in this version");

      // Alternatively, we could make the call to the API if it exists
      /*
      const response = await fetch(`/api/multichain/accounts/${walletId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        // Update local state
        setWallets(wallets.filter(wallet => wallet.id !== walletId));
        toast.success("Wallet removed successfully");
      } else {
        toast.error("Failed to remove wallet");
      }
      */
    } catch (error) {
      console.error("Error removing wallet:", error);
      toast.error("Failed to remove wallet");
    }
  };

  // Handle file upload for profile picture
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");

  const handleImageUpload = async (file: File) => {
    if (!file) return;

    try {
      setIsUploadingImage(true);
      setUploadProgress(0);
      setUploadError("");

      // Step 1: Get a presigned upload URL from the backend
      const response = await fetch(`${API_URL}/api/files/upload-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          fileType: file.type,
          fileName: file.name,
          folder: "profile-pictures",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get upload URL");
      }

      const { uploadUrl, filePath, downloadUrl } = await response.json();

      // Step 2: Upload the file directly to storage with progress tracking
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("Content-Type", file.type);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round(
            (event.loaded / event.total) * 100
          );
          setUploadProgress(percentComplete);
        }
      };

      await new Promise((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(xhr.response);
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error("Upload failed"));
        xhr.send(file);
      });

      // Step 3: Update the user profile with the new image URL
      const updateData = {
        image: downloadUrl,
      };

      updateUser(updateData, {
        onSuccess: () => {
          toast.success("Profile picture updated successfully");
        },
        onError: (error) => {
          console.error("Error updating profile picture:", error);
          toast.error("Failed to update profile picture");
        },
      });
    } catch (error) {
      console.error("Image upload error:", error);
      setUploadError(
        error instanceof Error ? error.message : "Failed to upload image"
      );
      toast.error("Failed to upload profile picture");
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Get chain name from currency list
  const getChainName = (chainId: string) => {
    const currency = currencies.find((c) => c.chainId === chainId);
    return currency ? currency.name : chainId;
  };

  // Filter wallets based on selected chain
  const filteredWallets =
    selectedChainFilter === "All Chains"
      ? wallets
      : wallets.filter((wallet) => wallet.chainId === selectedChainFilter);

  // Function to toggle dropdowns
  const toggleDropdown = (dropdown: string) => {
    setActiveDropdown(activeDropdown === dropdown ? null : dropdown);
  };

  // Dropdown animation variants
  const dropdownVariants = {
    hidden: {
      opacity: 0,
      y: -5,
      scale: 0.95,
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.2,
        ease: "easeOut",
      },
    },
    exit: {
      opacity: 0,
      y: -5,
      scale: 0.95,
      transition: {
        duration: 0.15,
        ease: "easeIn",
      },
    },
  };

  // Fix dropdown display and organize currencies by grouping
  const renderCurrencyDropdown = () => {
    if (isLoadingCurrencies) {
      return (
        <div className="px-4 py-3 text-white/60 flex items-center">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          <span>Loading currencies...</span>
        </div>
      );
    }

    // Use the cached organized currencies from our hook
    const fiatCurrencies = organizedCurrencies?.fiatCurrencies || [];
    const chainGroups = organizedCurrencies?.chainGroups || {};

    return (
      <>
        {/* Fiat Currencies */}
        <div className="px-4 py-2 text-sm text-white/50 font-medium">Fiat</div>
        {fiatCurrencies.map((currency) => (
          <button
            key={`fiat-${currency.id}`}
            type="button"
            className={`w-full px-4 py-2 text-left text-white hover:bg-white/5 flex items-center ${
              currency.id === preferredCurrency ? "bg-white/5" : ""
            }`}
            onClick={() => {
              setPreferredCurrency(currency.id);
              setActiveDropdown(null);
            }}
          >
            <div
              className={`w-5 h-5 flex items-center justify-center rounded-md border ${
                currency.id === preferredCurrency
                  ? "border-white bg-white"
                  : "border-white/30 bg-transparent"
              } mr-3`}
            >
              {currency.id === preferredCurrency && (
                <Check className="h-3.5 w-3.5 text-black" />
              )}
            </div>
            <div>
              <span className="font-medium">{currency.id}</span>
              <span className="text-white/70"> • {currency.name}</span>
            </div>
          </button>
        ))}

        {/* Chain Currencies */}
        {Object.entries(chainGroups).map(([chainId, currencies]) => (
          <div key={`chain-${chainId}`}>
            <div className="px-4 py-2 mt-2 text-sm text-white/50 font-medium">
              {chainId}
            </div>
            {currencies.map((currency) => (
              <button
                key={`chain-${chainId}-${currency.id}`}
                type="button"
                className={`w-full px-4 py-2 text-left text-white hover:bg-white/5 flex items-center ${
                  currency.id === preferredCurrency ? "bg-white/5" : ""
                }`}
                onClick={() => {
                  setPreferredCurrency(currency.id);
                  setActiveDropdown(null);
                }}
              >
                <div
                  className={`w-5 h-5 flex items-center justify-center rounded-md border ${
                    currency.id === preferredCurrency
                      ? "border-white bg-white"
                      : "border-white/30 bg-transparent"
                  } mr-3`}
                >
                  {currency.id === preferredCurrency && (
                    <Check className="h-3.5 w-3.5 text-black" />
                  )}
                </div>
                <div>
                  <span className="font-medium">{currency.symbol}</span>
                  <span className="text-white/70"> • {currency.name}</span>
                </div>
              </button>
            ))}
          </div>
        ))}
      </>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-white/50" />
          <p className="text-white/70 text-lg">Loading your profile...</p>
        </div>
      </div>
    );
  }

  console.log(isAuthenticated, user);

  if (!isAuthenticated || !user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-white/70 text-lg">
          You need to be logged in to view this page. Redirecting...
        </div>
      </div>
    );
  }

  console.log("filteredWallets", filteredWallets);

  return (
    <motion.div
      variants={fadeIn}
      initial="initial"
      animate="animate"
      className="flex w-full min-h-screen bg-black rounded-xl"
    >
      <div className="w-[750px] pl-10 pt-10 pr-4 pb-24">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-semibold text-white">Settings</h1>
          <div className="flex gap-3">
            <button
              onClick={handleSaveChanges}
              disabled={!hasChanges || isSaving}
              className={`flex items-center justify-center gap-1 sm:gap-2 rounded-full border text-white h-10 sm:h-12 px-4 sm:px-6 text-mobile-sm sm:text-base font-medium transition-all disabled:cursor-not-allowed ${
                hasChanges
                  ? "bg-black text-black border-white hover:bg-zinc-900"
                  : "bg-transparent border-white/20 text-white/40"
              }`}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="flex items-center justify-center gap-1 sm:gap-2 rounded-full bg-transparent border border-white/20 text-white h-10 sm:h-12 px-4 sm:px-6 text-mobile-sm sm:text-base font-medium hover:bg-white/5 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoggingOut ? (
                <>
                  <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                  <span>Logging out...</span>
                </>
              ) : (
                <>
                  <LogOut className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span>Logout</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Profile Photo Upload */}
        <div className="mb-8">
          <p className="text-white mb-3">Upload your PFP</p>
          <div className="flex items-center gap-5">
            <div className="relative">
              <div className="w-[100px] h-[100px] rounded-full border border-dashed border-white/30 flex items-center justify-center overflow-hidden">
                {user.image ? (
                  <Image
                    src={user.image}
                    alt="Profile"
                    width={100}
                    height={100}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="text-xs text-white/60 text-center p-2">
                    PNGs, JPGs
                  </div>
                )}
                {isUploadingImage && (
                  <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-white mb-2" />
                    <span className="text-xs text-white">
                      {uploadProgress}%
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col">
              <label
                htmlFor="profile-upload"
                className={`bg-transparent border border-white/20 text-white rounded-full px-6 py-2.5 hover:bg-white/5 transition cursor-pointer ${
                  isUploadingImage ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                {isUploadingImage ? "Uploading..." : "Select Image"}
                <input
                  id="profile-upload"
                  type="file"
                  accept="image/png, image/jpeg"
                  className="hidden"
                  disabled={isUploadingImage}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleImageUpload(file);
                    }
                  }}
                />
              </label>
              {uploadError && (
                <p className="text-red-500 text-xs mt-2">{uploadError}</p>
              )}
            </div>
          </div>
        </div>

        {/* Display Name */}
        <div className="mb-8">
          <label htmlFor="display-name" className="block text-white mb-2">
            Display Name
          </label>
          <input
            id="display-name"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full bg-black border border-white/20 text-white p-3 rounded-lg h-12 focus:outline-none focus:ring-1 focus:ring-white/40"
            placeholder="Enter your name"
          />
        </div>

        <div className="mb-8">
          <label className="block text-white mb-2 flex items-center gap-2">
            Preferred Tokens
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-white/80" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    Select the tokens you want to accept payments in
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </label>

          <CurrencyDropdown
            selectedCurrencies={selectedCurrencies}
            setSelectedCurrencies={setSelectedCurrencies}
          />
        </div>

        {/* Preferred Currency - Single Dropdown */}
        <div className="mb-8">
          <label className="block text-white mb-2">Preferred Currency</label>
          <div className="relative">
            <button
              type="button"
              onClick={() => toggleDropdown("currency")}
              className="w-full h-12 bg-black border border-white/20 text-white rounded-lg px-4 
                flex items-center justify-between focus:outline-none focus:ring-1 focus:ring-white/40"
            >
              <span className="truncate text-left">
                {isLoadingCurrencies
                  ? "Loading currencies..."
                  : (() => {
                      const selected = currencies.find(
                        (c) => c.id === preferredCurrency
                      );
                      return selected ? (
                        <span>
                          <span className="font-medium">
                            {selected.type === "FIAT"
                              ? selected.id
                              : selected.symbol}
                          </span>
                          <span className="text-white/70">
                            {" • "}
                            {selected.name}
                          </span>
                        </span>
                      ) : (
                        preferredCurrency
                      );
                    })()}
              </span>
              <ChevronDown
                className={`h-5 w-5 text-white/70 transition-transform duration-200 ${
                  activeDropdown === "currency" ? "rotate-180" : ""
                } ml-2 flex-shrink-0`}
              />
            </button>

            <AnimatePresence>
              {activeDropdown === "currency" && (
                <motion.div
                  variants={dropdownVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="absolute top-full left-0 right-0 mt-1 bg-[#17171A] rounded-lg py-2 z-10 max-h-[320px] overflow-y-auto shadow-xl border border-white/10"
                >
                  {renderCurrencyDropdown()}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Divider Line */}
        <div className="h-px w-full bg-white/10 my-8"></div>

        {/* Wallet Management */}
        <div className="mb-8">
          <button
            onClick={() => setIsWalletModalOpen(true)}
            disabled={isAddingWallet}
            className="w-full flex items-center justify-center h-10 sm:h-12 gap-1 sm:gap-2 bg-white text-black rounded-full px-4 sm:px-6 text-mobile-sm sm:text-base font-medium hover:bg-white/90 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isAddingWallet ? (
              <>
                <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                <span>Adding Wallet...</span>
              </>
            ) : (
              <span>Add Wallet</span>
            )}
          </button>

          {/* Select for Chain Filter */}
          <div className="mt-2 mb-6">
            <Select
              value={selectedChainFilter}
              onValueChange={setSelectedChainFilter}
            >
              <SelectTrigger className="w-full bg-black border border-white/20 text-white h-12 rounded-full focus:ring-1 focus:ring-white/40">
                <SelectValue placeholder="All Chains" />
              </SelectTrigger>
              <SelectContent className="bg-[#101012] border border-white/10 p-2 rounded-xl shadow-xl w-[var(--radix-select-trigger-width)]">
                <SelectItem
                  value="All Chains"
                  className="text-white hover:bg-white/90 rounded-lg px-4 py-2.5 my-1 focus:bg-white/90"
                >
                  All Chains
                </SelectItem>
                {isLoadingCurrencies ? (
                  <div className="px-4 py-3 text-white/60 flex items-center">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    <span>Loading chains...</span>
                  </div>
                ) : (
                  // Get unique chains from crypto currencies
                  Array.from(
                    new Set(
                      currencies
                        .filter((c) => c.type !== "FIAT" && c.chainId)
                        .map((c) => c.chainId)
                    )
                  )
                    .filter(Boolean)
                    .map((chainId) => {
                      // Find an example currency to get the chain name
                      const chainCurrency = currencies.find(
                        (c) => c.chainId === chainId
                      );
                      const chainName = chainId;

                      return (
                        <SelectItem
                          key={chainId}
                          value={chainId as string}
                          className="text-white hover:bg-white/90 rounded-lg px-4 py-2.5 my-1 focus:bg-white/90"
                        >
                          {chainName}
                        </SelectItem>
                      );
                    })
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Wallet List */}
          <div className="space-y-6">
            {isLoadingWallets ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-white/50" />
              </div>
            ) : filteredWallets.length > 0 ? (
              filteredWallets.map((wallet) => (
                <div key={wallet.id} className="pb-6 mb-2">
                  <div className="flex items-center justify-between">
                    <p className="text-white font-mono">
                      {wallet.address.length > 20
                        ? wallet.address.slice(0, 17) +
                          "..." +
                          wallet.address.slice(-4)
                        : wallet.address}
                    </p>
                    {!wallet.isDefault ? (
                      <div className="flex items-center">
                        <button
                          onClick={() => handleSetAsPrimary(wallet.id)}
                          className="border border-white/80 text-white text-sm rounded-full px-4 py-1.5 hover:bg-white/5 transition"
                        >
                          Set as primary
                        </button>
                        <button
                          onClick={() => removeWallet(wallet.id)}
                          className="text-white/70 p-1.5 rounded-full hover:bg-white/5 transition ml-2"
                        >
                          <Minus className="h-5 w-5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="text-white/60 text-sm">
                          Primary Wallet
                        </div>
                        <button
                          onClick={() => removeWallet(wallet.id)}
                          className="text-white/70 p-1.5 rounded-full hover:bg-white/5 transition ml-2"
                        >
                          <Minus className="h-5 w-5" />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="mt-2">
                    <p className="text-white/60 text-sm">
                      {getChainName(wallet.chainId)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-white/50">
                You don't have any wallets yet. Add one to get started.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Wallet Modal */}
      <AddWalletModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
        onWalletAdded={handleWalletAdded}
      />
    </motion.div>
  );
}
