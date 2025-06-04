"use client";

import React from "react";
import { WagmiProvider, type State } from "wagmi";
import { wagmiConfig, projectId } from "@/config/web3modal";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createWeb3Modal } from "@web3modal/wagmi/react";

// Setup queryClient
const queryClient = new QueryClient();

// Create the modal instance once when this module is loaded on the client-side.
// Ensure this only runs on the client side for Next.js App Router compatibility.
if (typeof window !== "undefined") {
  createWeb3Modal({
    wagmiConfig,
    projectId,
    // You can add back any optional WalletConnect parameters here if needed
    // e.g., themeMode, themeVariables, featuredWalletIds
  });
}

export function Web3Provider({
  children,
  initialState,
}: {
  children: React.ReactNode;
  initialState?: State;
}) {
  return (
    <WagmiProvider config={wagmiConfig} initialState={initialState}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
