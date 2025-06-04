"use client";

import React from "react";
import { WagmiProvider, type State } from "wagmi";
import { wagmiConfig } from "@/config/web3modal";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Setup queryClient
const queryClient = new QueryClient();

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
