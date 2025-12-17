// SPDX-FileCopyrightText: 2025 Social Connect Labs, Inc.
// SPDX-License-Identifier: BUSL-1.1
// NOTE: Converts to Apache-2.0 on 2029-06-11 per LICENSE.

/**
 * Utilities for generating bridge explorer URLs for LayerZero and Wormhole
 */

import type { EndpointType } from '@selfxyz/common';
import { CHAIN_CONFIG, getChainByEndpointType } from '@selfxyz/common';

export type BridgeProtocol = 'layerzero' | 'wormhole';

/**
 * Get bridge explorer URL based on protocol and transaction hash
 */
export function getBridgeExplorerUrl(
  protocol: BridgeProtocol,
  originChainId: number,
  txHash: string,
): string | null {
  if (protocol === 'layerzero') {
    return getLayerZeroScanUrl(originChainId, txHash);
  } else if (protocol === 'wormhole') {
    return getWormholeScanUrl(txHash);
  }
  return null;
}

/**
 * Get chain explorer URL for a transaction hash
 */
export function getChainExplorerUrl(
  chainId: number,
  txHash: string,
): string | null {
  const config = CHAIN_CONFIG[chainId];
  if (!config) return null;

  // Map chain IDs to explorer URLs
  const explorers: Record<number, string> = {
    42220: 'https://celoscan.io', // Celo Mainnet
    11142220: 'https://celo-sepolia.blockscout.com', // Celo Sepolia
    8453: 'https://basescan.org', // Base Mainnet
    84532: 'https://sepolia.basescan.org', // Base Sepolia
    100: 'https://gnosisscan.io', // Gnosis
    10: 'https://optimistic.etherscan.io', // Optimism
  };

  const baseUrl = explorers[chainId];
  return baseUrl ? `${baseUrl}/tx/${txHash}` : null;
}

/**
 * Get LayerZero Scan URL for tracking cross-chain messages
 */
function getLayerZeroScanUrl(chainId: number, txHash: string): string | null {
  // LayerZero uses different chain IDs (LZ chain IDs)
  const lzChainIds: Record<number, number> = {
    42220: 125, // Celo Mainnet
    11142220: 40286, // Celo Sepolia (testnet)
    8453: 184, // Base Mainnet
    84532: 40245, // Base Sepolia
    100: 145, // Gnosis
    10: 111, // Optimism
  };

  const lzChainId = lzChainIds[chainId];
  if (!lzChainId) return null;

  // Use mainnet or testnet scan based on chain
  const isTestnet = chainId === 11142220 || chainId === 84532;
  const baseUrl = isTestnet
    ? 'https://testnet.layerzeroscan.com'
    : 'https://layerzeroscan.com';

  return `${baseUrl}/tx/${txHash}`;
}

/**
 * Get Wormhole Scan URL for tracking cross-chain messages
 */
function getWormholeScanUrl(txHash: string): string {
  // Wormhole has a single explorer for all chains
  return `https://wormholescan.io/#/tx/${txHash}`;
}

/**
 * Get chain name from chain ID
 */
export function getChainName(chainId: number): string {
  const config = CHAIN_CONFIG[chainId];
  return config?.name || `Chain ${chainId}`;
}

/**
 * Get chain name from endpoint type
 */
export function getChainNameFromEndpointType(
  endpointType: EndpointType,
): string {
  try {
    const config = getChainByEndpointType(endpointType);
    return config.name;
  } catch {
    return 'Unknown Chain';
  }
}
