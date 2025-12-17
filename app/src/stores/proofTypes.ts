// SPDX-FileCopyrightText: 2025 Social Connect Labs, Inc.
// SPDX-License-Identifier: BUSL-1.1
// NOTE: Converts to Apache-2.0 on 2029-06-11 per LICENSE.

import type { EndpointType, UserIdType } from '@selfxyz/common/utils';

export interface BridgeStatus {
  status: 'pending' | 'in_progress' | 'complete' | 'failed';
  protocol?: 'layerzero' | 'wormhole'; // Once determined
  detail?: string;
  eta?: string;
}

export interface ChainStatus {
  status: 'pending' | 'complete' | 'failed';
  txHash?: string;
}

export interface MultichainStatus {
  isMultichain: boolean;
  destChainId?: number;
  destChainName?: string;
  origin: ChainStatus;
  bridge: BridgeStatus;
  destination: ChainStatus;
}

export interface ProofDB {
  updateStaleProofs: (
    updateProofStatus: (id: string, status: ProofStatus) => Promise<void>,
  ) => Promise<void>;
  getPendingProofs: () => Promise<ProofDBResult>;
  getHistory: (page?: number) => Promise<ProofDBResult>;
  init: () => Promise<void>;
  insertProof: (
    proof: Omit<ProofHistory, 'id' | 'timestamp'>,
  ) => Promise<{ id: string; timestamp: number; rowsAffected: number }>;
  updateProofStatus: (
    status: ProofStatus,
    errorCode: string | undefined,
    errorReason: string | undefined,
    sessionId: string,
  ) => Promise<void>;
  updateMultichainStatus: (
    sessionId: string,
    multichainData: MultichainStatus,
  ) => Promise<void>;
}

export interface ProofDBResult {
  rows: ProofHistory[];
  rowsAffected?: number;
  insertId?: string;
  total_count?: number;
}

export interface ProofHistory {
  id: string;
  appName: string;
  sessionId: string;
  userId: string;
  userIdType: UserIdType;
  endpoint?: string;
  endpointType: EndpointType;
  status: ProofStatus;
  errorCode?: string;
  errorReason?: string;
  timestamp: number;
  disclosures: string;
  logoBase64?: string;
  documentId: string;
  multichain?: MultichainStatus;
}

export enum ProofStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILURE = 'failure',
}
