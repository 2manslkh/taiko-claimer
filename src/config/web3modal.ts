// import { createWeb3Modal } from '@web3modal/wagmi/react' // This import is no longer needed here
import { defaultWagmiConfig } from '@web3modal/wagmi/react/config'

import { type Chain } from 'viem' // Import Chain type from viem
import { mainnet } from 'viem/chains'; // Import mainnet directly

// 0. Replace 'YOUR_PROJECT_ID' with your WalletConnect Cloud project ID
export const projectId = process.env.NEXT_PUBLIC_PROJECT_ID || 'YOUR_PROJECT_ID'

if (!projectId || projectId === 'YOUR_PROJECT_ID') {
    console.warn(
        "Warning: NEXT_PUBLIC_PROJECT_ID is not set or is still the placeholder. Please set it in your .env.local file or replace 'YOUR_PROJECT_ID' directly."
    )
}

// 1. Define chains
const chains = [mainnet] as [Chain, ...Chain[]]; // Use only mainnet

// 2. Create wagmiConfig
const metadata = {
    name: 'Taiko Token Claimer',
    description: 'Claim your Taiko vesting tokens',
    url: 'https://web3modal.com', // origin must match your domain & subdomain
    icons: ['https://avatars.githubusercontent.com/u/37784886']
}

export const wagmiConfig = defaultWagmiConfig({
    chains: chains,
    projectId,
    metadata,
    // Optional - Add your own preferred wallet connectors
    // connectors: [],
    // Optional - Configure Coinbase Wallet SDK
    // enableCoinbase: true, // default true
    // Optional - Configure Email Connector
    // enableEmail: true, // default true
})

// 3. Create modal
// createWeb3Modal({ // <--- REMOVE THIS CALL
//     wagmiConfig,
//     projectId,
//     // Optional - Add custom themes
//     // themeMode: 'light',
//     // themeVariables: {
//     //   '--w3m-font-family': 'Roboto, sans-serif',
//     //   '--w3m-accent': '#00BB7F'
//     // },
//     // Optional - Add custom featured wallets
//     // featuredWalletIds: [],
//     // Optional - Add custom chains
//     // chains // Not needed if already in wagmiConfig
// }) // <--- REMOVE THIS CALL

export function Web3ModalProvider({ children }: { children: React.ReactNode }) {
    return children; // The actual provider will be in layout.tsx
}

// Helper to get environment variables
export const getEnv = (key: string, defaultValue?: string): string => {
    const value = process.env[key];
    if (value === undefined) {
        if (defaultValue === undefined) {
            throw new Error(`Missing environment variable: ${key}`);
        }
        return defaultValue;
    }
    return value;
}; 