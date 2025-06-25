import { apiClient } from "@/api-helpers/client";
import {
  StellarWalletsKit,
  WalletNetwork,
} from "@creit.tech/stellar-wallets-kit";

type UnsignedTxResponse = {
  serializedTx: string;
  txHash: string;
  settlementId: string;
  tokenSymbol?: string;
  chainName?: string;
};

export const settleDebt = async (
  payload: {
    groupId: string;
    address: string;
    settleWithId?: string;
    selectedTokenId?: string;
    selectedChainId?: string;
    amount?: number;
  },
  wallet: StellarWalletsKit | undefined
) => {
  console.log("[settleDebt] POST /groups/settle-transaction/create", payload);
  
  // Create the transaction - no wallet needed here, just the user's address
  const unsignedTx: UnsignedTxResponse = await apiClient.post(
    "/groups/settle-transaction/create",
    payload
  );
  console.log("[settleDebt] unsignedTx response", unsignedTx);

  // Check if wallet is connected before proceeding with signing
  if (!wallet) {
    throw new Error("Wallet is not connected. Please connect your Stellar wallet first.");
  }

  // Now we need the wallet to sign the transaction
  // Determine the correct network passphrase based on the wallet's configuration
  let networkPassphrase = WalletNetwork.TESTNET;
  
  try {
    // Try to get the wallet's current network configuration
    const walletConfig = (wallet as any).config;
    if (walletConfig && walletConfig.network) {
      networkPassphrase = walletConfig.network;
    }
  } catch (error) {
    console.log("[settleDebt] Could not determine wallet network, using TESTNET as default");
  }

  // Log what is being sent to signTransaction
  console.log("[settleDebt] About to call wallet.signTransaction with:", {
    serializedTx: unsignedTx.serializedTx,
    type: typeof unsignedTx.serializedTx,
    length: unsignedTx.serializedTx?.length,
    options: { networkPassphrase }
  });

  const signedTx = await wallet.signTransaction(unsignedTx.serializedTx, {
    networkPassphrase,
  });
  console.log("[settleDebt] signedTx", signedTx);

  console.log("[settleDebt] POST /groups/settle-transaction/submit", {
    signedTx: signedTx.signedTxXdr,
    groupId: payload.groupId,
    settlementId: unsignedTx.settlementId,
    settleWithId: payload.settleWithId,
  });

  const submitTx = await apiClient.post("/groups/settle-transaction/submit", {
    signedTx: signedTx.signedTxXdr,
    groupId: payload.groupId,
    settlementId: unsignedTx.settlementId,
    settleWithId: payload.settleWithId,
  });
  console.log("[settleDebt] submitTx response", submitTx);

  return submitTx.data;
};
