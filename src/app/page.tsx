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
import { RefreshCw, AlertTriangle } from "lucide-react";

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
import { Checkbox } from "@/components/ui/checkbox";
import { vestingData, type VestingEntry } from "@/data/vesting-data";
import vestingContractAbi from "@/abi/vestingContract.json";

const STATIC_TGE_TIMESTAMP = 1717588800; // Unix timestamp in seconds
const STATIC_ONE_YEAR = 31536000; // Seconds in one year
const CLAIM_ELIGIBILITY_TIMESTAMP = STATIC_TGE_TIMESTAMP + STATIC_ONE_YEAR;
const TOKEN_DECIMALS = 18; // For TKO token

const ETHERSCAN_BASE_URL = "https://etherscan.io/address/";
const COINMARKETCAP_URL = "https://coinmarketcap.com/currencies/taiko/";

export default function HomePage() {
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
  const [isUnsafeMode, setIsUnsafeMode] = useState<boolean>(false);

  // Find vesting info based on connected address or user input
  useEffect(() => {
    if (isConnected && connectedAddress) {
      setUserInputAddress(connectedAddress); // Always set user input to connected address for reference
      const found = vestingData.find(
        (v) => v.recipient.toLowerCase() === connectedAddress.toLowerCase()
      );
      if (found) {
        setVestingInfo(found);
        setDerivedProxyAddress(found.proxy);
        // toast.success('Wallet connected and vesting info loaded.'); // Optional: feedback
      } else {
        setVestingInfo(null);
        setDerivedProxyAddress(undefined);
        // Consider a gentle toast here if the connected address is not in the list
        // toast.info(`Your connected address (${connectedAddress.slice(0,6)}...${connectedAddress.slice(-4)}) was not found in the vesting data. You can try entering a different recipient or proxy address manually if this dApp instance is configured for read-only mode for non-listed addresses.`);
      }
    } else {
      // Wallet is disconnected
      setVestingInfo(null);
      setDerivedProxyAddress(undefined);
      // Optionally clear userInputAddress if you don't want it to persist after disconnect
      // setUserInputAddress('');
      // Or, keep it, so if they disconnect to type, their input isn't lost.
      // For now, let's not clear it automatically on disconnect.
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
      setWithdrawAmountInput(formatEther(withdrawableAmount)); // formatEther defaults to 18 decimals
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
    let amountToWithdrawBigInt: bigint;
    try {
      if (!withdrawAmountInput.trim()) {
        toast.error("Please enter an amount to withdraw.");
        return;
      }
      amountToWithdrawBigInt = parseUnits(withdrawAmountInput, TOKEN_DECIMALS);
    } catch (error) {
      console.error("Error parsing withdraw amount:", error);
      toast.error("Invalid withdrawal amount. Please enter a valid number.");
      return;
    }

    if (!isUnsafeMode) {
      if (!derivedProxyAddress) {
        toast.error("Vesting contract address not loaded.");
        return;
      }
      if (!isConnected || !connectedAddress) {
        toast.error("Please connect your wallet to claim.");
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
      if (amountToWithdrawBigInt <= BigInt(0)) {
        toast.error("Withdrawal amount must be greater than zero.");
        return;
      }
      if (
        typeof withdrawableAmount !== "bigint" ||
        amountToWithdrawBigInt > withdrawableAmount
      ) {
        toast.error(
          "Withdrawal amount cannot exceed the currently withdrawable amount or available amount not loaded."
        );
        return;
      }
      if (
        typeof withdrawableAmount !== "bigint" ||
        amountToWithdrawBigInt > withdrawableAmount
      ) {
        toast.error(
          "Cannot withdraw more than the available amount (safety check)."
        );
        return;
      }
    } else {
      if (!isConnected || !connectedAddress) {
        toast.error(
          "Unsafe mode: Wallet still needs to be connected to send transaction."
        );
        return;
      }
      if (!derivedProxyAddress) {
        toast.error("Unsafe mode: Proxy address still needed for transaction.");
        return;
      }
      toast.info(
        <div className="flex items-center">
          <AlertTriangle className="h-5 w-5 mr-2 text-yellow-400" />
          <span>UNSAFE MODE ACTIVE: Bypassing most claim checks.</span>
        </div>,
        { duration: 5000 }
      );
    }

    if (typeof amountToWithdrawBigInt === "undefined") {
      toast.error(
        "Withdrawal amount was not properly defined. Please check input."
      );
      return;
    }

    claimTokens(
      {
        abi: vestingContractAbi,
        address: derivedProxyAddress as Address,
        functionName: "withdraw",
        args: [connectedAddress as Address, amountToWithdrawBigInt],
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
      refetchWithdrawableAmount();
      refetchAmountVested();
      setWithdrawAmountInput("");
    }
  }, [isClaimConfirmed, refetchWithdrawableAmount, refetchAmountVested]);

  useEffect(() => {
    if (claimError) {
      toast.error(
        `Claim transaction error: ${
          (claimError as Error).message || "An unknown error occurred"
        }`
      );
    }
  }, [claimError]);

  const formattedContractAmountVested = useMemo(() => {
    if (
      contractAmountVested !== undefined &&
      typeof contractAmountVested === "bigint"
    ) {
      return parseFloat(formatEther(contractAmountVested)).toFixed(4); // Display with 4 decimal places
    }
    return "Loading...";
  }, [contractAmountVested]);

  const formattedWithdrawableAmount = useMemo(() => {
    if (
      withdrawableAmount !== undefined &&
      typeof withdrawableAmount === "bigint"
    ) {
      return parseFloat(formatEther(withdrawableAmount)).toFixed(4); // Display with 4 decimal places
    }
    return "0.0000";
  }, [withdrawableAmount]);

  const canClaim = useMemo(() => {
    if (isUnsafeMode) {
      return (
        isConnected &&
        !!derivedProxyAddress &&
        withdrawAmountInput.trim() !== "" &&
        !isClaiming &&
        !isConfirming
      );
    }
    if (!withdrawAmountInput.trim()) return false;
    try {
      const amount = parseUnits(withdrawAmountInput, TOKEN_DECIMALS);
      return (
        isClaimTime &&
        isConnected &&
        !isClaiming &&
        !isConfirming &&
        amount > BigInt(0) &&
        typeof withdrawableAmount === "bigint" &&
        amount <= withdrawableAmount &&
        vestingInfo?.recipient.toLowerCase() === connectedAddress?.toLowerCase()
      );
    } catch {
      return false;
    }
  }, [
    isUnsafeMode,
    withdrawAmountInput,
    isClaimTime,
    isConnected,
    isClaiming,
    isConfirming,
    withdrawableAmount,
    vestingInfo,
    connectedAddress,
    derivedProxyAddress,
  ]);

  const handleSetMaxWithdraw = () => {
    if (
      withdrawableAmount !== undefined &&
      typeof withdrawableAmount === "bigint"
    ) {
      setWithdrawAmountInput(formatEther(withdrawableAmount));
      toast.info("Withdraw amount set to maximum available.");
    } else {
      toast.info("Withdrawable amount not available or already zero.");
    }
  };

  return (
    <div className="flex flex-col items-center justify-start min-h-screen py-12 bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      <Card className="w-full max-w-md bg-slate-800 border-slate-700 shadow-xl mb-12">
        <CardHeader>
          <CardTitle className="text-center text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500">
            Taiko Vesting Token Claim
          </CardTitle>
          <CardDescription className="text-center text-slate-400 pt-2">
            Connect your wallet or enter an address to view vesting details and
            claim your TKO tokens.
          </CardDescription>
          <div className="text-center pt-3">
            <a
              href={COINMARKETCAP_URL}
              target="_blank"
              rel="noopener noreferrer"
              title="View Taiko on CoinMarketCap"
              className="text-blue-400 hover:text-blue-300 underline text-sm font-medium"
            >
              COIN MARKETCAP
            </a>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center">
            <appkit-button />
          </div>

          {/* Unsafe Mode Checkbox */}
          <div className="flex items-center space-x-2 justify-center pt-4 border-t border-slate-700 mt-4">
            <Checkbox
              id="unsafeMode"
              checked={isUnsafeMode}
              onCheckedChange={(checked) => setIsUnsafeMode(Boolean(checked))}
              className="border-slate-600 data-[state=checked]:bg-yellow-500 data-[state=checked]:text-slate-900"
            />
            <Label
              htmlFor="unsafeMode"
              className={`text-sm font-medium ${
                isUnsafeMode ? "text-yellow-400" : "text-slate-300"
              }`}
            >
              Enable Unsafe Mode (Bypass Checks)
            </Label>
          </div>
          {isUnsafeMode && (
            <div className="flex items-center justify-center p-3 bg-yellow-900/30 border border-yellow-700 rounded-md text-yellow-300 text-xs">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Warning: Unsafe mode is active. Claim checks are bypassed.
            </div>
          )}

          {/* Show manual input ONLY if NOT connected, OR if connected AND in unsafe mode (allowing override) */}
          {(!isConnected || (isConnected && isUnsafeMode)) && (
            <div className="space-y-2 pt-4 border-t border-slate-700 mt-4">
              <Label htmlFor="addressInput" className="text-slate-300">
                {isUnsafeMode && isConnected
                  ? "Enter Recipient/Proxy to Override (Unsafe Mode):"
                  : "Enter Recipient or Proxy Address (Read-Only View):"}
              </Label>
              <div className="flex space-x-2">
                <Input
                  id="addressInput"
                  type="text"
                  placeholder="0x..."
                  value={userInputAddress} // This will show connected address if connected, or manual input
                  onChange={(e) => setUserInputAddress(e.target.value)}
                  disabled={isConnected && !isUnsafeMode} // Disable if connected and NOT in unsafe mode
                  className="bg-slate-700 border-slate-600 text-white placeholder-slate-500 focus:ring-pink-500 focus:border-pink-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <Button
                  onClick={handleLoadAddressInfo}
                  variant="secondary"
                  className="bg-pink-600 hover:bg-pink-700 text-white"
                  disabled={isConnected && !isUnsafeMode} // Disable if connected and NOT in unsafe mode
                >
                  Load Info
                </Button>
              </div>
              {isConnected && isUnsafeMode && (
                <p className="text-xs text-yellow-400 text-center">
                  Inputting an address here in Unsafe Mode will attempt to
                  override vesting data lookup based on your connected wallet.
                </p>
              )}
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
                  Total Vested (Contract):
                </span>{" "}
                {isLoadingContractAmountVested
                  ? "Loading..."
                  : errorAmountVested
                  ? "Error"
                  : `${formattedContractAmountVested} TKO`}
              </p>

              <div className="flex items-center justify-between">
                <p
                  className={`text-xl font-semibold ${
                    errorWithdrawableAmount ? "text-red-400" : "text-pink-400"
                  }`}
                >
                  Withdrawable Now:{" "}
                  {errorWithdrawableAmount
                    ? "Error"
                    : formattedWithdrawableAmount}{" "}
                  TKO
                </p>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    refetchWithdrawableAmount();
                    refetchAmountVested();
                  }}
                  disabled={
                    isLoadingWithdrawableAmount || isLoadingContractAmountVested
                  }
                  className="border-pink-500 text-pink-500 hover:bg-pink-500/10 hover:text-pink-400 disabled:opacity-50"
                  title="Refresh amounts"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${
                      isLoadingWithdrawableAmount ||
                      isLoadingContractAmountVested
                        ? "animate-spin"
                        : ""
                    }`}
                  />
                </Button>
              </div>
              {isLoadingWithdrawableAmount && !errorWithdrawableAmount && (
                <p className="text-slate-400 text-xs">
                  Loading withdrawable amount...
                </p>
              )}
              {!isLoadingWithdrawableAmount && errorWithdrawableAmount && (
                <p className="text-red-400 text-xs">
                  Could not load withdrawable amount. Try refreshing.
                </p>
              )}

              {/* Withdraw Amount Input */}
              <div className="space-y-2">
                <Label htmlFor="withdrawAmount" className="text-slate-300">
                  Amount to Withdraw (TKO):
                </Label>
                <div className="flex space-x-2 items-center">
                  <Input
                    id="withdrawAmount"
                    type="text"
                    placeholder={`Max: ${formattedWithdrawableAmount}`}
                    value={withdrawAmountInput}
                    onChange={(e) => setWithdrawAmountInput(e.target.value)}
                    disabled={
                      !isConnected ||
                      isLoadingWithdrawableAmount ||
                      isConfirming ||
                      isClaiming ||
                      typeof withdrawableAmount !== "bigint"
                    }
                    className="flex-grow bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:ring-pink-500 focus:border-pink-500 disabled:opacity-70"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSetMaxWithdraw}
                    disabled={
                      !isConnected ||
                      isLoadingWithdrawableAmount ||
                      isConfirming ||
                      isClaiming ||
                      typeof withdrawableAmount !== "bigint"
                    }
                    className="border-pink-500 text-pink-500 hover:bg-pink-500/10 hover:text-pink-400 disabled:opacity-50 whitespace-nowrap"
                  >
                    Set Max
                  </Button>
                </div>
              </div>
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
              disabled={!canClaim}
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

      {/* Vesting Data Table Section */}
      <div className="w-full max-w-5xl mx-auto mt-8 px-4">
        <h2 className="text-2xl font-semibold text-center mb-6 text-slate-200">
          All Vesting Contract Data
        </h2>
        <div className="overflow-x-auto bg-slate-800 border border-slate-700 rounded-lg shadow-lg">
          <table className="min-w-full divide-y divide-slate-700">
            <thead className="bg-slate-750 sticky top-0 z-10">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider"
                >
                  #
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider"
                >
                  Recipient Address
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider"
                >
                  Proxy Contract
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-right text-xs font-medium text-slate-300 uppercase tracking-wider"
                >
                  Total Vested (TKO)
                </th>
              </tr>
            </thead>
            <tbody className="bg-slate-800 divide-y divide-slate-700">
              {vestingData.map((entry, index) => (
                <tr
                  key={index}
                  className={`${
                    index % 2 === 0 ? "bg-slate-800" : "bg-slate-850"
                  } hover:bg-slate-700/50 transition-colors`}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                    {index + 1}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                    <a
                      href={`${ETHERSCAN_BASE_URL}${entry.recipient}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-pink-400 transition-colors"
                      title={entry.recipient}
                    >
                      {`${entry.recipient.slice(
                        0,
                        6
                      )}...${entry.recipient.slice(-4)}`}
                    </a>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                    <a
                      href={`${ETHERSCAN_BASE_URL}${entry.proxy}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-pink-400 transition-colors"
                      title={entry.proxy}
                    >
                      {`${entry.proxy.slice(0, 6)}...${entry.proxy.slice(-4)}`}
                    </a>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300 text-right">
                    {entry.vestAmount.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
