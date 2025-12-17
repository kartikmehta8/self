// SPDX-FileCopyrightText: 2025 Social Connect Labs, Inc.
// SPDX-License-Identifier: BUSL-1.1
// NOTE: Converts to Apache-2.0 on 2029-06-11 per LICENSE.

import { Linking } from 'react-native';

import {
  handleDeeplinkCallbackNavigation,
  isSelfHostedDeeplink,
} from '@/utils/deeplinkCallbacks';

jest.mock('react-native', () => ({
  Linking: {
    openURL: jest.fn(),
  },
}));

describe('deeplinkCallbacks', () => {
  const mockNavigation = {
    navigate: jest.fn(),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('routes self-hosted https callbacks through in-app WebView', async () => {
    await handleDeeplinkCallbackNavigation({
      deeplinkCallback: 'https://apps.self.xyz/proof/done',
      navigation: mockNavigation,
    });

    expect(mockNavigation.navigate).toHaveBeenCalledWith('WebView', {
      url: 'https://apps.self.xyz/proof/done',
      title: 'Explore Apps',
    });
    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  it('opens non-self callbacks externally', async () => {
    await handleDeeplinkCallbackNavigation({
      deeplinkCallback: 'https://example.com/next',
      navigation: mockNavigation,
    });

    expect(mockNavigation.navigate).not.toHaveBeenCalled();
    expect(Linking.openURL).toHaveBeenCalledWith('https://example.com/next');
  });

  it('treats malformed callbacks as external fallbacks', async () => {
    await handleDeeplinkCallbackNavigation({
      deeplinkCallback: 'not-a-url',
      navigation: mockNavigation,
    });

    expect(mockNavigation.navigate).not.toHaveBeenCalled();
    expect(Linking.openURL).toHaveBeenCalledWith('not-a-url');
  });

  it('detects self-hosted https deeplinks', () => {
    expect(isSelfHostedDeeplink('https://apps.self.xyz/foo')).toBe(true);
    expect(isSelfHostedDeeplink('https://malicious.com/foo')).toBe(false);
    expect(isSelfHostedDeeplink('ftp://apps.self.xyz/foo')).toBe(false);
  });
});
