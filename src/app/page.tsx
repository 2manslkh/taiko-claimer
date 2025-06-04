"use client";

import { useEffect, useState, useMemo } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSwitchChain,
} from "wagmi";
import { formatEther, type Address, isAddress, parseUnits } from "viem";
import { toast } from "sonner";
import { mainnet } from "viem/chains";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { vestingData, type VestingEntry } from "@/data/vesting-data";
import vestingContractAbi from "@/abi/vestingContract.json";
import { useWeb3Modal } from "@web3modal/wagmi/react";

const STATIC_TGE_TIMESTAMP = 1717588800; // Unix timestamp in seconds
const STATIC_ONE_YEAR = 31536000; // Seconds in one year
const CLAIM_ELIGIBILITY_TIMESTAMP = STATIC_TGE_TIMESTAMP + STATIC_ONE_YEAR;
const TOKEN_DECIMALS = 18; // For TKO token

const ETHERSCAN_BASE_URL = "https://etherscan.io/address/";

export default function HomePage() {
  const { open } = useWeb3Modal();
  const {
    address: connectedAddress,
    isConnected,
    chainId: currentChainId,
  } = useAccount();
  const { switchChain } = useSwitchChain();

  const [userInputAddress, setUserInputAddress] = useState<string>("");
  const [derivedProxyAddress, setDerivedProxyAddress] = useState<
    Address | undefined
  >(undefined);
  const [vestingInfo, setVestingInfo] = useState<VestingEntry | null>(null);
  const [countdown, setCountdown] = useState<string>("");
  const [isClaimTime, setIsClaimTime] = useState<boolean>(false);
  const [withdrawAmountInput, setWithdrawAmountInput] = useState<string>("");

  // Find vesting info based on connected address or user input
  useEffect(() => {
    if (isConnected && connectedAddress) {
      const found = vestingData.find(
        (v) => v.recipient.toLowerCase() === connectedAddress.toLowerCase()
      );
      if (found) {
        setVestingInfo(found);
        setDerivedProxyAddress(found.proxy);
        setUserInputAddress(connectedAddress); // Populate input for reference
      } else {
        setVestingInfo(null);
        setDerivedProxyAddress(undefined);
      }
    } else {
      // Reset if disconnected
      setVestingInfo(null);
      setDerivedProxyAddress(undefined);
    }
  }, [isConnected, connectedAddress]);

  const handleLoadAddressInfo = () => {
    if (!userInputAddress) {
      toast.error("Please enter a recipient or proxy address.");
      return;
    }
    if (!isAddress(userInputAddress)) {
      toast.error("Invalid Ethereum address entered.");
      return;
    }

    let foundProxy: Address | undefined = undefined;
    let foundVestingInfo: VestingEntry | null = null;

    const lowerUserInputAddress = userInputAddress.toLowerCase();

    // Check if input is a recipient address first
    const foundByRecipient = vestingData.find(
      (v) => v.recipient.toLowerCase() === lowerUserInputAddress
    );
    if (foundByRecipient) {
      foundVestingInfo = foundByRecipient;
      foundProxy = foundByRecipient.proxy;
    } else {
      // Check if input is a proxy address
      const foundByProxy = vestingData.find(
        (v) => v.proxy.toLowerCase() === lowerUserInputAddress
      );
      if (foundByProxy) {
        foundVestingInfo = foundByProxy;
        foundProxy = foundByProxy.proxy;
      } else {
        toast.info("Address not found in vesting data as recipient or proxy.");
      }
    }
    setVestingInfo(foundVestingInfo);
    setDerivedProxyAddress(foundProxy);
    setWithdrawAmountInput(""); // Reset withdraw input when address changes
  };

  // Countdown timer effect
  useEffect(() => {
    const calculateCountdown = () => {
      const now = Math.floor(Date.now() / 1000); // Current time in seconds
      const timeLeft = CLAIM_ELIGIBILITY_TIMESTAMP - now;

      if (timeLeft <= 0) {
        setCountdown("Claiming is now open!");
        setIsClaimTime(true);
        return;
      }
      setIsClaimTime(false);

      const days = Math.floor(timeLeft / (60 * 60 * 24));
      const hours = Math.floor((timeLeft % (60 * 60 * 24)) / (60 * 60));
      const minutes = Math.floor((timeLeft % (60 * 60)) / 60);
      const seconds = Math.floor(timeLeft % 60);
      setCountdown(`${days}d ${hours}h ${minutes}m ${seconds}s`);
    };

    calculateCountdown(); // Initial call
    const intervalId = setInterval(calculateCountdown, 1000); // Update every second

    return () => clearInterval(intervalId); // Cleanup on unmount
  }, []);

  // Wagmi Read: amountVested
  const {
    data: contractAmountVested,
    isLoading: isLoadingContractAmountVested,
    refetch: refetchAmountVested,
    error: errorAmountVested,
  } = useReadContract({
    abi: vestingContractAbi,
    address: derivedProxyAddress,
    functionName: "amountVested",
    chainId: mainnet.id,
    query: {
      enabled: !!derivedProxyAddress, // Only run if proxy address is set
    },
  });

  // Wagmi Read: amountWithdrawable
  const {
    data: withdrawableAmount,
    isLoading: isLoadingWithdrawableAmount,
    refetch: refetchWithdrawableAmount,
    error: errorWithdrawableAmount,
  } = useReadContract({
    abi: vestingContractAbi,
    address: derivedProxyAddress,
    functionName: "amountWithdrawable",
    chainId: mainnet.id,
    query: {
      enabled: !!derivedProxyAddress, // Only run if proxy address is set
    },
  });

  useEffect(() => {
    if (errorAmountVested) {
      toast.error(
        `Error fetching total vested amount: ${
          (errorAmountVested as Error).message || "An unknown error occurred"
        }`
      );
    }
    if (errorWithdrawableAmount) {
      toast.error(
        `Error fetching withdrawable amount: ${
          (errorWithdrawableAmount as Error).message ||
          "An unknown error occurred"
        }`
      );
    }
  }, [errorAmountVested, errorWithdrawableAmount]);

  // Auto-fill withdraw input with max withdrawable amount when it loads
  useEffect(() => {
    if (
      withdrawableAmount !== undefined &&
      typeof withdrawableAmount === "bigint"
    ) {
      setWithdrawAmountInput(formatEther(withdrawableAmount, "wei")); // Keep full precision for input
    }
  }, [withdrawableAmount]);

  // Wagmi Write: withdraw
  const {
    data: claimTxHash,
    writeContract: claimTokens,
    isPending: isClaiming,
    error: claimError,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isClaimConfirmed } =
    useWaitForTransactionReceipt({
      hash: claimTxHash,
    });

  const handleClaim = async () => {
    if (!derivedProxyAddress) {
      toast.error("Vesting contract address not loaded.");
      return;
    }
    if (!isConnected || !connectedAddress) {
      toast.error("Please connect your wallet to claim.");
      open(); // Open modal to connect
      return;
    }
    if (currentChainId !== mainnet.id) {
      toast.error("Please switch to Ethereum Mainnet to claim.");
      switchChain({ chainId: mainnet.id });
      return;
    }
    if (
      vestingInfo?.recipient.toLowerCase() !== connectedAddress.toLowerCase()
    ) {
      toast.error(
        "Connected wallet does not match the recipient address for this vesting contract."
      );
      return;
    }

    claimTokens(
      {
        abi: vestingContractAbi,
        address: derivedProxyAddress,
        functionName: "withdraw",
        args: [connectedAddress, withdrawableAmount as bigint], // _to, _amount
        chainId: mainnet.id,
      },
      {
        onSuccess: () => {
          toast.info("Claim transaction submitted...");
        },
        onError: (err: Error) => {
          toast.error(`Claim failed: ${err.message}`);
        },
      }
    );
  };

  useEffect(() => {
    if (isClaimConfirmed) {
      toast.success("Tokens claimed successfully!");
      refetchAmountWithdrawable(); // Refresh withdrawable amount
    }
  }, [isClaimConfirmed, refetchAmountWithdrawable]);

  useEffect(() => {
    if (claimError) {
      toast.error(
        `Claim transaction error: ${
          (claimError as Error).message || "An unknown error occurred"
        }`
      );
    }
  }, [claimError]);

  const formattedWithdrawableAmount = useMemo(() => {
    if (
      withdrawableAmount !== undefined &&
      typeof withdrawableAmount === "bigint"
    ) {
      return parseFloat(formatEther(withdrawableAmount)).toFixed(4);
    }
    return "0.0000";
  }, [withdrawableAmount]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-12 bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      <Card className="w-full max-w-md bg-slate-800 border-slate-700 shadow-xl">
        <CardHeader>
          <CardTitle className="text-center text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500">
            Taiko Vesting Token Claim
          </CardTitle>
          <CardDescription className="text-center text-slate-400 pt-2">
            Connect your wallet or enter an address to view vesting details and
            claim your TKO tokens.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center">
            <w3m-button />
          </div>

          {!isConnected && (
            <div className="space-y-2 pt-4">
              <Label htmlFor="addressInput" className="text-slate-300">
                Enter Recipient or Proxy Address (Read-Only):
              </Label>
              <div className="flex space-x-2">
                <Input
                  id="addressInput"
                  type="text"
                  placeholder="0x..."
                  value={userInputAddress}
                  onChange={(e) => setUserInputAddress(e.target.value)}
                  className="bg-slate-700 border-slate-600 text-white placeholder-slate-500 focus:ring-pink-500 focus:border-pink-500"
                />
                <Button
                  onClick={handleLoadAddressInfo}
                  variant="secondary"
                  className="bg-pink-600 hover:bg-pink-700 text-white"
                >
                  Load Info
                </Button>
              </div>
            </div>
          )}

          {derivedProxyAddress && (
            <div className="space-y-4 pt-4 border-t border-slate-700 mt-4">
              <h3 className="text-lg font-semibold text-slate-200">
                Vesting Contract Information:
              </h3>
              <p className="text-sm text-slate-400">
                <span className="font-medium text-slate-300">Recipient:</span>{" "}
                {vestingInfo?.recipient ? (
                  <a
                    href={`${ETHERSCAN_BASE_URL}${vestingInfo.recipient}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-pink-400 transition-colors"
                  >
                    {vestingInfo.recipient}
                  </a>
                ) : (
                  "N/A"
                )}
              </p>
              <p className="text-sm text-slate-400">
                <span className="font-medium text-slate-300">
                  Proxy Contract:
                </span>{" "}
                <a
                  href={`${ETHERSCAN_BASE_URL}${derivedProxyAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-pink-400 transition-colors"
                >
                  {derivedProxyAddress}
                </a>
              </p>
              <p className="text-sm text-slate-400">
                <span className="font-medium text-slate-300">
                  Total Vesting (from data):
                </span>{" "}
                {vestingInfo
                  ? (vestingInfo.vestAmount / 10 ** 4).toFixed(4)
                  : "N/A"}{" "}
                TKO{" "}
                <span className="text-xs">(example, assumes 4 decimals)</span>
              </p>

              <div className="flex items-center justify-between">
                <p
                  className={`text-xl font-semibold ${
                    errorAmount ? "text-red-400" : "text-pink-400"
                  }`}
                >
                  Withdrawable Now:{" "}
                  {errorAmount ? "Error" : formattedWithdrawableAmount} TKO
                </p>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => refetchAmountWithdrawable()}
                  disabled={isLoadingAmount}
                  className="border-pink-500 text-pink-500 hover:bg-pink-500/10 hover:text-pink-400 disabled:opacity-50"
                  title="Refresh withdrawable amount"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${
                      isLoadingAmount ? "animate-spin" : ""
                    }`}
                  />
                </Button>
              </div>
              {isLoadingAmount && !errorAmount && (
                <p className="text-slate-400 text-xs">
                  Loading withdrawable amount...
                </p>
              )}
              {!isLoadingAmount && errorAmount && (
                <p className="text-red-400 text-xs">
                  Could not load withdrawable amount. Try refreshing.
                </p>
              )}
            </div>
          )}

          {vestingInfo && !derivedProxyAddress && isConnected && (
            <p className="text-center text-yellow-400 pt-4">
              No vesting contract found for your connected address (
              {connectedAddress?.slice(0, 6)}...{connectedAddress?.slice(-4)}).
            </p>
          )}

          <div className="pt-4 text-center space-y-2">
            <p className="text-lg font-medium text-slate-300">
              Claim Eligibility Countdown:
            </p>
            <p
              className={`text-2xl font-bold ${
                isClaimTime ? "text-green-400" : "text-yellow-400"
              }`}
            >
              {countdown}
            </p>
          </div>
        </CardContent>
        {derivedProxyAddress && (
          <CardFooter className="flex flex-col space-y-3 pt-6 border-t border-slate-700">
            <Button
              onClick={handleClaim}
              disabled={
                !isClaimTime ||
                !isConnected ||
                isClaiming ||
                isConfirming ||
                !withdrawableAmount ||
                withdrawableAmount === BigInt(0) ||
                vestingInfo?.recipient.toLowerCase() !==
                  connectedAddress?.toLowerCase()
              }
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isClaiming
                ? "Claiming..."
                : isConfirming
                ? "Confirming Transaction..."
                : "Claim Tokens"}
            </Button>
            {!isConnected && (
              <p className="text-sm text-center text-slate-400">
                Connect your wallet to claim.
              </p>
            )}
            {isConnected &&
              vestingInfo?.recipient.toLowerCase() !==
                connectedAddress?.toLowerCase() && (
                <p className="text-sm text-center text-red-400">
                  Connected wallet ({connectedAddress?.slice(0, 6)}...
                  {connectedAddress?.slice(-4)}) does not match the recipient
                  address for this vesting contract.
                </p>
              )}
          </CardFooter>
        )}
      </Card>
      <p className="text-center text-xs text-slate-500 mt-8">
        Ensure you are on Ethereum Mainnet. Replace YOUR_PROJECT_ID in web3modal
        config.
        <br />
        Token decimal display for &apos;Total Vesting&apos; and
        &apos;Withdrawable Now&apos; assumes 18 decimals for formatting. Adjust
        if TKO has a different precision.
      </p>
    </div>
  );
}
