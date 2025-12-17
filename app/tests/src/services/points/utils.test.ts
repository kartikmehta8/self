// SPDX-FileCopyrightText: 2025 Social Connect Labs, Inc.
// SPDX-License-Identifier: BUSL-1.1
// NOTE: Converts to Apache-2.0 on 2029-06-11 per LICENSE.

import { pointsSelfApp } from '@/services/points/utils';

jest.mock('uuid', () => ({
  v4: jest.fn(),
}));

jest.mock('@/providers/authProvider', () => ({
  getOrGeneratePointsAddress: jest.fn(),
}));

const mockUuid = jest.requireMock('uuid').v4 as jest.Mock;
const mockGetOrGeneratePointsAddress = jest.requireMock(
  '@/providers/authProvider',
).getOrGeneratePointsAddress as jest.Mock;

describe('pointsSelfApp', () => {
  beforeEach(() => {
    mockUuid.mockReset();
    mockGetOrGeneratePointsAddress.mockReset();
  });

  it('builds a SelfApp with wallet-bound metadata and deeplink callback', async () => {
    mockUuid
      .mockImplementationOnce(() => 'nonce-uuid')
      .mockImplementationOnce(() => 'session-uuid');
    mockGetOrGeneratePointsAddress.mockResolvedValue(
      '0xABCDEF1234567890ABCDEF1234567890ABCDEF12',
    );

    const selfApp = await pointsSelfApp();
    const metadata = JSON.parse(selfApp.userDefinedData);

    expect(selfApp.userIdType).toBe('hex');
    expect(selfApp.userId).toBe('abcdef1234567890abcdef1234567890abcdef12');
    expect(selfApp.deeplinkCallback).toBe('https://apps.self.xyz');
    expect(metadata.nonce).toBe('nonce-uuid');
    expect(metadata.wallet).toBe('0xabcdef1234567890abcdef1234567890abcdef12');
    expect(metadata.action).toBe('points-disclosure');
    expect(new Date(metadata.issuedAt).toString()).not.toBe('Invalid Date');
    expect(selfApp.selfDefinedData).toBe(
      '0xabcdef1234567890abcdef1234567890abcdef12',
    );
  });
});
