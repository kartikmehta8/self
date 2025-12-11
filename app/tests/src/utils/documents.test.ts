// SPDX-FileCopyrightText: 2025 Social Connect Labs, Inc.
// SPDX-License-Identifier: BUSL-1.1
// NOTE: Converts to Apache-2.0 on 2029-06-11 per LICENSE.

import type { IDDocument } from '@selfxyz/common';
import type { DocumentMetadata, SelfClient } from '@selfxyz/mobile-sdk-alpha';

// Import module under test after mocks are set up
import {
  _resetCommitmentTreeCache,
  isDocumentInactive,
} from '@/utils/documents';

// Mock dependencies before importing the module under test
const mockGetAlternativeCSCA = jest.fn();
jest.mock('@/proving/validateDocument', () => ({
  getAlternativeCSCA: jest.fn((...args: unknown[]) =>
    mockGetAlternativeCSCA(...args),
  ),
}));

const mockIsUserRegisteredWithAlternativeCSCA = jest.fn();
jest.mock('@selfxyz/common/utils/passports/validate', () => ({
  isUserRegisteredWithAlternativeCSCA: jest.fn((...args: unknown[]) =>
    mockIsUserRegisteredWithAlternativeCSCA(...args),
  ),
}));

const mockGetCommitmentTree = jest.fn();
jest.mock('@selfxyz/mobile-sdk-alpha/stores', () => ({
  getCommitmentTree: jest.fn((...args: unknown[]) =>
    mockGetCommitmentTree(...args),
  ),
}));

describe('isDocumentInactive', () => {
  // Mock implementations
  const mockFetchAllPassport = jest.fn();
  const mockFetchAllIdCard = jest.fn();
  const mockFetchAllAadhaar = jest.fn();
  const mockGetPrivateKey = jest.fn();

  const createMockSelfClient = (): SelfClient =>
    ({
      getPrivateKey: mockGetPrivateKey,
      getProtocolState: jest.fn(() => ({
        passport: { fetch_all: mockFetchAllPassport },
        id_card: { fetch_all: mockFetchAllIdCard },
        aadhaar: { fetch_all: mockFetchAllAadhaar },
      })),
      useProtocolStore: {},
    }) as unknown as SelfClient;

  const createMockDocument = (
    category: 'passport' | 'id_card' | 'aadhaar',
    authorityKeyIdentifier?: string,
  ): IDDocument =>
    ({
      documentCategory: category,
      dsc_parsed: authorityKeyIdentifier
        ? { authorityKeyIdentifier }
        : undefined,
    }) as unknown as IDDocument;

  const createMockMetadata = (
    overrides: Partial<DocumentMetadata> = {},
  ): DocumentMetadata =>
    ({
      id: 'test-doc-id',
      documentType: 'passport',
      documentCategory: 'passport',
      mock: false,
      isRegistered: true,
      registeredAt: undefined,
      ...overrides,
    }) as DocumentMetadata;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the commitment tree cache to ensure test isolation
    _resetCommitmentTreeCache();
    // Reset all mock implementations to default successful state
    mockGetPrivateKey.mockResolvedValue('test-secret');
    mockFetchAllPassport.mockResolvedValue(undefined);
    mockFetchAllIdCard.mockResolvedValue(undefined);
    mockFetchAllAadhaar.mockResolvedValue(undefined);
    mockIsUserRegisteredWithAlternativeCSCA.mockResolvedValue({
      isRegistered: true,
    });
    mockGetAlternativeCSCA.mockReturnValue(null);
    mockGetCommitmentTree.mockReturnValue('mock-commitment-tree');
  });

  describe('recently registered documents', () => {
    it('returns false when document was registered within last 5 minutes', async () => {
      const selfClient = createMockSelfClient();
      const document = createMockDocument('passport');
      const recentTimestamp = Date.now() - 2 * 60 * 1000; // 2 minutes ago
      const metadata = createMockMetadata({ registeredAt: recentTimestamp });

      const result = await isDocumentInactive(selfClient, document, metadata);

      expect(result).toBe(false);
      // Should not call fetch_all or check registration since we short-circuit
      expect(mockFetchAllPassport).not.toHaveBeenCalled();
      expect(mockIsUserRegisteredWithAlternativeCSCA).not.toHaveBeenCalled();
    });

    it('returns false when document was registered exactly 4 minutes ago', async () => {
      const selfClient = createMockSelfClient();
      const document = createMockDocument('passport');
      const recentTimestamp = Date.now() - 4 * 60 * 1000; // 4 minutes ago
      const metadata = createMockMetadata({ registeredAt: recentTimestamp });

      const result = await isDocumentInactive(selfClient, document, metadata);

      expect(result).toBe(false);
    });

    it('continues with full check when document was registered more than 5 minutes ago', async () => {
      const selfClient = createMockSelfClient();
      const document = createMockDocument('passport', 'test-aki');
      const oldTimestamp = Date.now() - 10 * 60 * 1000; // 10 minutes ago
      const metadata = createMockMetadata({ registeredAt: oldTimestamp });

      await isDocumentInactive(selfClient, document, metadata);

      expect(mockFetchAllPassport).toHaveBeenCalled();
      expect(mockIsUserRegisteredWithAlternativeCSCA).toHaveBeenCalled();
    });

    it('continues with full check when registeredAt is undefined', async () => {
      const selfClient = createMockSelfClient();
      const document = createMockDocument('passport', 'test-aki');
      const metadata = createMockMetadata({ registeredAt: undefined });

      await isDocumentInactive(selfClient, document, metadata);

      expect(mockFetchAllPassport).toHaveBeenCalled();
      expect(mockIsUserRegisteredWithAlternativeCSCA).toHaveBeenCalled();
    });
  });

  describe('secret availability', () => {
    it('returns true when no secret is available', async () => {
      mockGetPrivateKey.mockResolvedValue(null);
      const selfClient = createMockSelfClient();
      const document = createMockDocument('passport', 'test-aki');
      const metadata = createMockMetadata();

      const result = await isDocumentInactive(selfClient, document, metadata);

      expect(result).toBe(true);
      // Should still fetch commitment tree
      expect(mockFetchAllPassport).toHaveBeenCalled();
      // But should not check registration
      expect(mockIsUserRegisteredWithAlternativeCSCA).not.toHaveBeenCalled();
    });

    it('returns true when secret is undefined', async () => {
      mockGetPrivateKey.mockResolvedValue(undefined);
      const selfClient = createMockSelfClient();
      const document = createMockDocument('passport', 'test-aki');
      const metadata = createMockMetadata();

      const result = await isDocumentInactive(selfClient, document, metadata);

      expect(result).toBe(true);
    });

    it('returns true when secret is empty string', async () => {
      mockGetPrivateKey.mockResolvedValue('');
      const selfClient = createMockSelfClient();
      const document = createMockDocument('passport', 'test-aki');
      const metadata = createMockMetadata();

      const result = await isDocumentInactive(selfClient, document, metadata);

      expect(result).toBe(true);
    });
  });

  describe('registration check', () => {
    it('returns false when document is registered', async () => {
      mockIsUserRegisteredWithAlternativeCSCA.mockResolvedValue({
        isRegistered: true,
      });
      const selfClient = createMockSelfClient();
      const document = createMockDocument('passport', 'test-aki');
      const metadata = createMockMetadata();

      const result = await isDocumentInactive(selfClient, document, metadata);

      expect(result).toBe(false);
    });

    it('returns true when document is not registered', async () => {
      mockIsUserRegisteredWithAlternativeCSCA.mockResolvedValue({
        isRegistered: false,
      });
      const selfClient = createMockSelfClient();
      const document = createMockDocument('passport', 'test-aki');
      const metadata = createMockMetadata();

      const result = await isDocumentInactive(selfClient, document, metadata);

      expect(result).toBe(true);
    });
  });

  describe('environment selection', () => {
    it('uses stg environment for mock documents', async () => {
      const selfClient = createMockSelfClient();
      const document = createMockDocument('passport', 'test-aki');
      const metadata = createMockMetadata({ mock: true });

      await isDocumentInactive(selfClient, document, metadata);

      expect(mockFetchAllPassport).toHaveBeenCalledWith('stg', 'test-aki');
    });

    it('uses prod environment for non-mock documents', async () => {
      const selfClient = createMockSelfClient();
      const document = createMockDocument('passport', 'test-aki');
      const metadata = createMockMetadata({ mock: false });

      await isDocumentInactive(selfClient, document, metadata);

      expect(mockFetchAllPassport).toHaveBeenCalledWith('prod', 'test-aki');
    });
  });

  describe('document category handling', () => {
    it('calls passport.fetch_all for passport documents', async () => {
      const selfClient = createMockSelfClient();
      const document = createMockDocument('passport', 'passport-aki');
      const metadata = createMockMetadata();

      await isDocumentInactive(selfClient, document, metadata);

      expect(mockFetchAllPassport).toHaveBeenCalledWith('prod', 'passport-aki');
      expect(mockFetchAllIdCard).not.toHaveBeenCalled();
      expect(mockFetchAllAadhaar).not.toHaveBeenCalled();
    });

    it('calls id_card.fetch_all for id_card documents', async () => {
      const selfClient = createMockSelfClient();
      const document = createMockDocument('id_card', 'id-card-aki');
      const metadata = createMockMetadata({ documentCategory: 'id_card' });

      await isDocumentInactive(selfClient, document, metadata);

      expect(mockFetchAllIdCard).toHaveBeenCalledWith('prod', 'id-card-aki');
      expect(mockFetchAllPassport).not.toHaveBeenCalled();
      expect(mockFetchAllAadhaar).not.toHaveBeenCalled();
    });

    it('calls aadhaar.fetch_all for aadhaar documents without authorityKeyIdentifier', async () => {
      const selfClient = createMockSelfClient();
      const document = createMockDocument('aadhaar');
      const metadata = createMockMetadata({ documentCategory: 'aadhaar' });

      await isDocumentInactive(selfClient, document, metadata);

      expect(mockFetchAllAadhaar).toHaveBeenCalledWith('prod');
      expect(mockFetchAllPassport).not.toHaveBeenCalled();
      expect(mockFetchAllIdCard).not.toHaveBeenCalled();
    });

    it('uses empty string for authorityKeyIdentifier when not present', async () => {
      const selfClient = createMockSelfClient();
      const document = createMockDocument('passport'); // No AKI
      const metadata = createMockMetadata();

      await isDocumentInactive(selfClient, document, metadata);

      expect(mockFetchAllPassport).toHaveBeenCalledWith('prod', '');
    });
  });

  describe('isUserRegisteredWithAlternativeCSCA integration', () => {
    it('passes correct arguments to isUserRegisteredWithAlternativeCSCA', async () => {
      const selfClient = createMockSelfClient();
      const document = createMockDocument('passport', 'test-aki');
      const metadata = createMockMetadata();

      await isDocumentInactive(selfClient, document, metadata);

      expect(mockIsUserRegisteredWithAlternativeCSCA).toHaveBeenCalledWith(
        document,
        'test-secret',
        expect.objectContaining({
          getCommitmentTree: expect.any(Function),
          getAltCSCA: expect.any(Function),
        }),
      );
    });

    it('getCommitmentTree callback uses getCommitmentTree from stores', async () => {
      const selfClient = createMockSelfClient();
      const document = createMockDocument('passport', 'test-aki');
      const metadata = createMockMetadata();

      await isDocumentInactive(selfClient, document, metadata);

      // Get the callbacks passed to isUserRegisteredWithAlternativeCSCA
      const callbacks =
        mockIsUserRegisteredWithAlternativeCSCA.mock.calls[0][2];

      // Call the getCommitmentTree callback
      callbacks.getCommitmentTree('passport');

      expect(mockGetCommitmentTree).toHaveBeenCalledWith(
        selfClient,
        'passport',
      );
    });

    it('getAltCSCA callback uses getAlternativeCSCA', async () => {
      const selfClient = createMockSelfClient();
      const document = createMockDocument('passport', 'test-aki');
      const metadata = createMockMetadata();

      await isDocumentInactive(selfClient, document, metadata);

      // Get the callbacks passed to isUserRegisteredWithAlternativeCSCA
      const callbacks =
        mockIsUserRegisteredWithAlternativeCSCA.mock.calls[0][2];

      // Call the getAltCSCA callback
      callbacks.getAltCSCA('passport');

      expect(mockGetAlternativeCSCA).toHaveBeenCalledWith(
        selfClient.useProtocolStore,
        'passport',
      );
    });
  });

  describe('commitment tree caching', () => {
    it('caches commitment tree fetch for same document category', async () => {
      const selfClient = createMockSelfClient();
      const document = createMockDocument('passport', 'test-aki');
      const metadata = createMockMetadata();

      // First call
      await isDocumentInactive(selfClient, document, metadata);
      expect(mockFetchAllPassport).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      await isDocumentInactive(selfClient, document, metadata);
      expect(mockFetchAllPassport).toHaveBeenCalledTimes(1); // Still 1
    });

    it('fetches separately for different document categories', async () => {
      const selfClient = createMockSelfClient();

      // Passport document
      const passportDoc = createMockDocument('passport', 'passport-aki');
      const passportMetadata = createMockMetadata();
      await isDocumentInactive(selfClient, passportDoc, passportMetadata);
      expect(mockFetchAllPassport).toHaveBeenCalledTimes(1);

      // ID card document - should trigger separate fetch
      const idCardDoc = createMockDocument('id_card', 'id-card-aki');
      const idCardMetadata = createMockMetadata({
        documentCategory: 'id_card',
      });
      await isDocumentInactive(selfClient, idCardDoc, idCardMetadata);
      expect(mockFetchAllIdCard).toHaveBeenCalledTimes(1);

      // Passport shouldn't be fetched again
      expect(mockFetchAllPassport).toHaveBeenCalledTimes(1);
    });

    it('cache persists across multiple calls for same category', async () => {
      const selfClient = createMockSelfClient();
      const document = createMockDocument('passport', 'test-aki');
      const metadata = createMockMetadata();

      // Multiple calls
      await isDocumentInactive(selfClient, document, metadata);
      await isDocumentInactive(selfClient, document, metadata);
      await isDocumentInactive(selfClient, document, metadata);

      // Should only fetch once
      expect(mockFetchAllPassport).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling', () => {
    it('propagates errors from getPrivateKey', async () => {
      mockGetPrivateKey.mockRejectedValue(new Error('Key retrieval failed'));
      const selfClient = createMockSelfClient();
      const document = createMockDocument('passport', 'test-aki');
      const metadata = createMockMetadata();

      await expect(
        isDocumentInactive(selfClient, document, metadata),
      ).rejects.toThrow('Key retrieval failed');
    });

    it('propagates errors from fetch_all', async () => {
      mockFetchAllPassport.mockRejectedValue(new Error('Fetch failed'));
      const selfClient = createMockSelfClient();
      const document = createMockDocument('passport', 'test-aki');
      const metadata = createMockMetadata();

      await expect(
        isDocumentInactive(selfClient, document, metadata),
      ).rejects.toThrow('Fetch failed');
    });

    it('propagates errors from isUserRegisteredWithAlternativeCSCA', async () => {
      mockIsUserRegisteredWithAlternativeCSCA.mockRejectedValue(
        new Error('Registration check failed'),
      );
      const selfClient = createMockSelfClient();
      const document = createMockDocument('passport', 'test-aki');
      const metadata = createMockMetadata();

      await expect(
        isDocumentInactive(selfClient, document, metadata),
      ).rejects.toThrow('Registration check failed');
    });
  });
});
