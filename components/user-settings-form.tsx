"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@/hooks/useWallet";
import Image from "next/image";
import {
  Upload,
  Loader2,
  Link,
  ExternalLink,
  DollarSign,
  LogOut,
  AlertCircle,
  Trash2,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { User } from "@/api-helpers/modelSchema/UserSchema";
import { useUpdateUser } from "@/features/user/hooks/use-update-profile";
import { UserDetails } from "@/features/user/api/client";
import { toast } from "sonner";
import { signOut } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useUploadFile } from "@/features/files/hooks/use-balances";
import { ConnectWalletModal } from "./connect-wallet-modal";
import ResolverSelector from "./ResolverSelector";
import type { Option } from "./ResolverSelector";
import { useUserWallets, useAddWallet } from "@/features/wallets/hooks/use-wallets";

// Currency options
const CURRENCIES = [
  { value: "USD", label: "USD - US Dollar", symbol: "$" },
  { value: "XLM", label: "XLM - Stellar Lumens", symbol: "XLM" },
];

// Stellar account addresses start with G and are 56 characters long
const stellarAddressPattern = /^G[A-Z0-9]{55}$/;

// Helper to check if an image URL is from DiceBear
const isDiceBearImage = (url: string | null | undefined): boolean => {
  if (!url) return false;
  return url.includes("api.dicebear.com");
};

// Add a local type that extends UserDetails to include timeLockInDefault
interface UserDetailsWithTimeLock extends UserDetails {
  timeLockInDefault: boolean;
}

export function UserSettingsForm({ user }: { user: User }) {
  const { mutate: updateUser, isPending } = useUpdateUser();
  const {
    isConnected,
    address,
    isConnecting,
    connectWallet,
    disconnectWallet,
    freighterAvailable,
    isHydrated,
  } = useWallet();
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  const uploadFileMutation = useUploadFile();
  const [stellarError, setStellarError] = useState<string | null>(null);
  const [showConnectWalletModal, setShowConnectWalletModal] = useState(false);
  const [resolver, setResolver] = useState<Option | undefined>(undefined);
  const { data: walletData } = useUserWallets();
  const wallets = walletData?.accounts || [];
  const { mutate: addWallet } = useAddWallet();

  const [formData, setFormData] = useState<UserDetailsWithTimeLock>({
    name: user.name || "",
    image: user.image || "",
    currency: user.currency || "USD",
    timeLockInDefault: false,
  });

  // Update the form with wallet address when connected
  useEffect(() => {
    if (isConnected && address) {
      setStellarError(null);
    }
  }, [isConnected, address]);

  // Validate Stellar account format
  const validateStellarAccount = (
    address: string | null | undefined
  ): boolean => {
    if (!address || address.trim() === "") {
      setStellarError(null);
      return true; // Empty is valid
    }

    const isValid = stellarAddressPattern.test(address);
    if (!isValid) {
      setStellarError(
        "Stellar account must start with 'G' and be 56 characters long"
      );
      return false;
    }

    setStellarError(null);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate Stellar account before submission
    if (
      !validateStellarAccount(address)
    ) {
      toast.error("Invalid Stellar account format", {
        description: stellarError,
      });
      return;
    }

    const loadingToast = toast.loading("Saving profile changes...");

    // Filter out undefined values and ensure proper types
    const updateData: any = {};

    if (
      formData.name !== undefined &&
      formData.name !== null &&
      formData.name.trim() !== ""
    ) {
      updateData.name = formData.name;
    }

    // If no custom image is set, use DiceBear
    if (!formData.image || formData.image.trim() === "") {
      updateData.image = `https://api.dicebear.com/9.x/identicon/svg?seed=${
        user.id || address || "user"
      }`;
    } else if (!isDiceBearImage(formData.image)) {
      // Only include the image if it's a custom image (not DiceBear)
      updateData.image = formData.image;
    }

    if (formData.currency) {
      updateData.currency = formData.currency;
    }

    if (formData.timeLockInDefault !== undefined && formData.timeLockInDefault !== null) {
      updateData.timeLockInDefault = formData.timeLockInDefault;
    }

    if (resolver) {
      updateData.resolverId = resolver.id;
      updateData.resolverChainId = resolver.chainId;
    }

    console.log("Submitting profile update with data:", updateData);

    updateUser(updateData, {
      onSuccess: (updatedUser) => {
        console.log("Profile updated successfully:", updatedUser);
        toast.dismiss(loadingToast);
        toast.success("Profile updated successfully!");
        
        // Update the auth store with the new user data
        setUser(updatedUser);
      },
      onError: (error) => {
        console.error("Error updating profile:", error);
        toast.dismiss(loadingToast);
        toast.error("Failed to update profile. Please try again.");
      },
    });
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Show loading state with a specific ID
      const loadingToast = toast.loading("Uploading image...");

      // Upload the file to Google Cloud Storage
      const response = await uploadFileMutation.mutateAsync(file);

      if (response.success) {
        // Update form data with the image URL
        setFormData((prev) => ({
          ...prev,
          image: response.data.downloadUrl,
        }));

        // Update the profile in database immediately with the new image URL
        updateUser(
          { image: response.data.downloadUrl },
          {
            onSuccess: (updatedUser) => {
              // Update the auth store with the new user data
              setUser(updatedUser);
              toast.dismiss(loadingToast);
              toast.success("Profile picture updated successfully");
            },
            onError: (error) => {
              toast.dismiss(loadingToast);
              toast.error("Failed to update profile with new image");
              console.error("Error updating profile with new image:", error);
            },
          }
        );
      } else {
        toast.dismiss(loadingToast);
        toast.error("Failed to upload image. Please try again.");
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.dismiss();
      toast.error("Failed to upload image. Please try again.");
    }
  };

  const handleConnectWallet = async () => {
    setShowConnectWalletModal(true);
  };

  const handleDisconnectWallet = async () => {
    try {
      // First disconnect the wallet from the frontend
      disconnectWallet();

      // Then remove the wallet address from the user's profile
      // Clear the form field first
      setFormData((prev) => ({ ...prev, stellarAccount: "" }));

      // Update with empty string instead of null
      updateUser(
        { stellarAccount: "" },
        {
          onSuccess: (updatedUser) => {
            // Update the auth store with the new user data
            setUser(updatedUser);
            toast.success("Wallet disconnected and removed from your profile");
          },
          onError: (error) => {
            toast.error("Failed to remove wallet from profile");
            console.error("Error removing wallet:", error);
          },
        }
      );
    } catch (error) {
      toast.error("Failed to disconnect wallet. Please try again.");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      setUser(null);
      toast.success("Logged out successfully");
      router.push("/login");
    } catch (error) {
      toast.error("Failed to log out. Please try again.");
    }
  };

  const handleStellarAccountChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = e.target.value;
    setStellarError(null);
  };

  const handleRemoveProfilePicture = () => {
    // Show loading toast
    const loadingToast = toast.loading("Removing profile picture...");

    // Generate the DiceBear Identicon URL to use as default
    const identicon = `https://api.dicebear.com/9.x/identicon/svg?seed=${
      user.id || user.email || "user"
    }`;

    // Update form state first for immediate UI feedback
    setFormData((prev) => ({ ...prev, image: "" }));

    // Update profile in the backend with the Identicon URL
    updateUser(
      { image: identicon },
      {
        onSuccess: (updatedUser) => {
          // Update the auth store with the new user data
          setUser(updatedUser);
          // Dismiss the specific loading toast
          toast.dismiss(loadingToast);
          toast.success("Profile picture removed successfully");

          // Update local form state with the Identicon URL for consistent UI
          setFormData((prev) => ({ ...prev, image: "" }));
        },
        onError: (error) => {
          // Dismiss the specific loading toast
          toast.dismiss(loadingToast);
          toast.error("Failed to remove profile picture");
          console.error("Error removing profile picture:", error);

          // Restore previous image on error
          setFormData((prev) => ({ ...prev, image: user.image || "" }));
        },
      }
    );
  };

  return (
    <>
      <div className="w-full bg-[#101012] border border-white/20 rounded-[18.24px] overflow-hidden">
        <div className="p-6">
          <h2 className="text-2xl font-semibold text-white leading-10 tracking-[-0.03em] mb-8 text-center">
            Profile Settings
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Profile Image */}
            <div className="flex flex-col items-center mb-6">
              <div className="relative h-24 w-24 mb-2">
                {/* Profile image container */}
                <div className="h-full w-full rounded-full overflow-hidden bg-gradient-to-br from-purple-500/20 to-blue-500/20 p-0.5">
                  <div className="h-full w-full rounded-full overflow-hidden bg-[#101012] flex items-center justify-center">
                    {formData.image && !isDiceBearImage(formData.image) ? (
                      <Image
                        src={formData.image}
                        alt="Profile"
                        width={96}
                        height={96}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Image
                        src={`https://api.dicebear.com/9.x/identicon/svg?seed=${
                          user.id || address || "user"
                        }`}
                        alt="Profile"
                        width={96}
                        height={96}
                        className="h-full w-full"
                      />
                    )}
                  </div>
                </div>

                {/* Upload button overlay */}
                <label className="absolute inset-0 cursor-pointer z-10">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageChange}
                    disabled={isPending}
                  />
                </label>
                <div className="absolute -right-2 -top-2 h-10 w-10 rounded-full bg-zinc-800 flex items-center justify-center border-2 border-white shadow-lg z-20">
                  <Upload className="h-5 w-5 text-white" />
                </div>
              </div>
              <p className="text-xs text-white/50 mb-2">
                Tap to change profile picture
              </p>

              {formData.image && !isDiceBearImage(formData.image) && (
                <button
                  type="button"
                  onClick={handleRemoveProfilePicture}
                  disabled={isPending}
                  className="flex items-center gap-1.5 text-sm text-red-400/80 hover:text-red-400 transition-colors mt-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove profile picture
                </button>
              )}
            </div>

            {/* Name */}
            <div className="space-y-2">
              <label className="block text-lg font-semibold text-white leading-7 tracking-[-0.03em]">
                Display Name
              </label>
              <input
                type="text"
                value={formData.name || ""}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                className="w-full h-[47.43px] bg-[#0D0D0F] rounded-[11.86px] px-4 
                       text-base font-semibold text-white/40 leading-6 border border-white/20"
                placeholder="Enter your name"
                disabled={isPending}
              />
            </div>

            {/* Preferred Currency */}
            <div className="space-y-2">
              <label className="block text-lg font-semibold text-white leading-7 tracking-[-0.03em]">
                Preferred Currency
              </label>
              <div className="relative w-full">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">
                  <DollarSign className="h-4 w-4" />
                </div>
                <select
                  value={formData.currency}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      currency: e.target.value,
                    }))
                  }
                  className="w-full h-[47.43px] bg-[#0D0D0F] rounded-[11.86px] pl-10 pr-4
                         text-base font-semibold text-white/40 leading-6 border border-white/20
                         appearance-none"
                  disabled={isPending}
                >
                  {CURRENCIES.map((currency) => (
                    <option key={currency.value} value={currency.value}>
                      {currency.label}
                    </option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg
                    className="h-4 w-4 text-white/40"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </div>
              <p className="text-sm text-white/40">
                This currency will be used as your default for transactions and
                displays
              </p>
            </div>

            {/* Time Lock-In Default Toggle */}
            <div className="flex items-center justify-between mt-4">
              <span className="text-white text-base">Lock exchange rate by default</span>
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, timeLockInDefault: !prev.timeLockInDefault }))}
                className={`w-12 h-6 rounded-full p-1 transition-colors ${formData.timeLockInDefault ? "bg-blue-500" : "bg-white/10"}`}
              >
                <div
                  className={`h-4 w-4 rounded-full bg-white transform transition-transform ${formData.timeLockInDefault ? "translate-x-6" : "translate-x-0"}`}
                />
              </button>
            </div>

            {/* Stellar Account */}
            <div className="space-y-2">
              <label className="block text-lg font-semibold text-white leading-7 tracking-[-0.03em]">
                Stellar Account Address
              </label>
              <div className="flex flex-col gap-2">
                <div className="relative w-full">
                  <input
                    type="text"
                    value={address || ""}
                    onChange={handleStellarAccountChange}
                    className={`w-full h-[47.43px] bg-[#0D0D0F] rounded-[11.86px] px-4
                           text-base font-semibold text-white/40 leading-6 border ${
                             stellarError ? "border-red-500" : "border-white/20"
                           }`}
                    placeholder="Enter your Stellar account address"
                    disabled={isPending || isConnecting}
                  />
                  {address && !stellarError && (
                    <a
                      href={`https://stellar.expert/explorer/testnet/account/${address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
                      title="View on Stellar Explorer"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                  {stellarError && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-red-500">
                      <AlertCircle className="h-4 w-4" />
                    </div>
                  )}
                </div>
                {stellarError && (
                  <p className="text-sm text-red-500">{stellarError}</p>
                )}
                <button
                  type="button"
                  onClick={connectWallet}
                  disabled={isPending || isConnecting}
                  className="h-[47.43px] bg-[#0D0D0F] rounded-[11.86px] px-4 text-base font-semibold text-white/70 leading-6 border border-white/20 hover:bg-white/5 transition-colors flex items-center justify-center gap-2"
                >
                  <Link className="h-4 w-4" />
                  Connect Stellar Wallet
                </button>

                {/* Show the disconnect wallet button if user has a wallet address stored in profile */}
                {(isConnected || address) && (
                  <button
                    type="button"
                    onClick={disconnectWallet}
                    disabled={isPending}
                    className="h-[47.43px] bg-transparent rounded-[11.86px] px-4 text-base font-semibold text-red-400/70 leading-6 border border-red-400/20 hover:bg-red-400/5 transition-colors flex items-center justify-center gap-2"
                  >
                    Disconnect & Remove Wallet
                  </button>
                )}

                <p className="text-sm text-white/40">
                  This is the address that will be used for transactions.
                  Connect your wallet to update automatically.
                </p>
              </div>
            </div>

            <div className="flex justify-center pt-4">
              <div className="animate-border-light">
                <button
                  type="submit"
                  className="w-[234.68px] h-[55.64px] bg-[#101012] rounded-[18.24px] 
                         text-xl font-semibold text-white leading-8 
                         tracking-[-0.03em] hover:bg-white/5 transition-colors
                         disabled:opacity-70 disabled:cursor-not-allowed
                         flex items-center justify-center gap-2"
                  disabled={isPending || !!stellarError}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </button>
              </div>
            </div>
          </form>

          <div className="mt-8 pt-8 border-t border-white/10">
            <button
              onClick={handleLogout}
              className="w-full h-[55.64px] bg-[#0D0D0F] rounded-[18.24px] 
                     text-base font-semibold text-red-400/80 leading-8 
                     hover:bg-red-400/5 transition-colors
                     border border-red-400/20
                     flex items-center justify-center gap-2"
            >
              <LogOut className="h-5 w-5" />
              Logout
            </button>
          </div>
        </div>
      </div>
      <ConnectWalletModal
        isOpen={showConnectWalletModal}
        onClose={() => setShowConnectWalletModal(false)}
      />
    </>
  );
}
