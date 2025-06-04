"use client";

import React, { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, cookieToInitialState, type Config } from "wagmi";
import { createAppKit } from "@reown/appkit/react";
import { config, networks, projectId, wagmiAdapter } from "@/config/reown"; // Adjusted import path
import { mainnet } from "@reown/appkit/networks"; // Default network

const queryClient = new QueryClient();

const metadata = {
  name: "Taiko Token Claim", // Updated App Name
  description: "Claim your vested Taiko (TKO) tokens.", // Updated App Description
  url:
    typeof window !== "undefined"
      ? window.location.origin
      : "https://your-taiko-claimer-url.com", // Replace with actual URL
  icons: ["/logo.png"], // Replace with your actual icon URL, e.g., /favicon.ico or a hosted image
};

// Initialize AppKit *outside* the component render cycle
if (!projectId) {
  console.error("AppKit Initialization Error: Project ID is missing.");
  // Consider throwing an error or rendering a fallback UI if this happens at runtime
  // However, the config file already throws an error if projectId is missing at build time.
} else {
  createAppKit({
    adapters: [wagmiAdapter],
    projectId: projectId!, // Non-null assertion as projectId is checked in config
    networks: networks,
    defaultNetwork: mainnet, // Ethereum Mainnet as default
    metadata,
    features: { analytics: true }, // Optional features, keeping analytics as per example
  });
}

export default function ReownProvider({
  children,
  cookies,
}: {
  children: ReactNode;
  cookies: string | null; // Cookies from server for hydration
}) {
  // Calculate initial state for Wagmi SSR hydration
  const initialState = cookieToInitialState(config as Config, cookies);

  return (
    <WagmiProvider config={config as Config} initialState={initialState}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
