// SPDX-FileCopyrightText: 2025 Social Connect Labs, Inc.
// SPDX-License-Identifier: BUSL-1.1
// NOTE: Converts to Apache-2.0 on 2029-06-11 per LICENSE.

import type {
  DocumentCategory,
  Environment,
  IDDocument,
} from '@selfxyz/common';
import { isUserRegisteredWithAlternativeCSCA } from '@selfxyz/common/utils/passports/validate';
import type { DocumentMetadata, SelfClient } from '@selfxyz/mobile-sdk-alpha';
import { getCommitmentTree } from '@selfxyz/mobile-sdk-alpha/stores';

import { getAlternativeCSCA } from '@/proving/validateDocument';

const REGISTERED_THRESHOLD_MINUTES = 5;

// Map to keep track of which commitment trees have already been fetched so
// we don't fetch them multiple times
const ALREADY_FETCHED_COMMITMENT_TREES = new Map<DocumentCategory, boolean>();

/**
 * Resets the commitment tree cache. Only for testing purposes.
 * @internal
 */
export function _resetCommitmentTreeCache(): void {
  ALREADY_FETCHED_COMMITMENT_TREES.clear();
}

const fetchRequiredCommitmentTree = async (
  selfClient: SelfClient,
  document: IDDocument,
  environment: Environment,
) => {
  if (
    ALREADY_FETCHED_COMMITMENT_TREES.get(document.documentCategory) === true
  ) {
    console.log(`${document.documentCategory} commitment tree already fetched`);

    return;
  }

  if (document.documentCategory === 'aadhaar') {
    await selfClient.getProtocolState().aadhaar.fetch_all(environment);
  } else {
    await selfClient
      .getProtocolState()
      [
        document.documentCategory
      ].fetch_all(environment, document.dsc_parsed?.authorityKeyIdentifier || '');
  }

  ALREADY_FETCHED_COMMITMENT_TREES.set(document.documentCategory, true);
};

export async function isDocumentInactive(
  selfClient: SelfClient,
  document: IDDocument,
  metadata: DocumentMetadata,
): Promise<boolean> {
  console.log(
    `Checking if ${document.documentCategory} document is inactive...`,
  );
  const secret = await selfClient.getPrivateKey();

  if (metadata.registeredAt) {
    const registeredAt = new Date(metadata.registeredAt);
    const now = new Date();
    const diffMs = now.getTime() - registeredAt.getTime();
    const diffMinutes = diffMs / (1000 * 60);

    if (diffMinutes < REGISTERED_THRESHOLD_MINUTES) {
      console.log('Document has been registered in the last 5 minutes');
      // We consider the document active if it was registered in the last 5 minutes
      // before checking the commitment tree
      return false;
    }
  }

  const environment = metadata.mock ? 'stg' : 'prod';

  await fetchRequiredCommitmentTree(selfClient, document, environment);

  // if secret is not available, the document is considered inactive
  if (!secret) {
    return true;
  }

  console.log(
    `Checking if document is registered in the ${document.documentCategory} commitment tree...`,
  );

  const { isRegistered } = await isUserRegisteredWithAlternativeCSCA(
    document,
    secret,
    {
      getCommitmentTree: docCategory =>
        getCommitmentTree(selfClient, docCategory),
      getAltCSCA: docCategory =>
        getAlternativeCSCA(selfClient.useProtocolStore, docCategory),
    },
  );

  console.log('Document is registered:', isRegistered);

  // TODO: add expiration check

  return !isRegistered;
}
