// SPDX-FileCopyrightText: 2025 Social Connect Labs, Inc.
// SPDX-License-Identifier: BUSL-1.1
// NOTE: Converts to Apache-2.0 on 2029-06-11 per LICENSE.

import { Linking } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '@/navigation';

const isSelfHostname = (hostname: string) => {
  return hostname === 'self.xyz' || hostname.endsWith('.self.xyz');
};

const isSelfHostedUrl = (deeplink: string): boolean => {
  try {
    const url = new URL(deeplink);
    if (url.protocol !== 'https:') {
      return false;
    }
    return isSelfHostname(url.hostname);
  } catch {
    return false;
  }
};

export const handleDeeplinkCallbackNavigation = async ({
  deeplinkCallback,
  navigation,
}: {
  deeplinkCallback: string;
  navigation: NativeStackNavigationProp<RootStackParamList>;
}) => {
  if (isSelfHostedUrl(deeplinkCallback)) {
    navigation.navigate('WebView', {
      url: deeplinkCallback,
      title: 'Explore Apps',
    });
    return;
  }

  await Linking.openURL(deeplinkCallback);
};

export const isSelfHostedDeeplink = isSelfHostedUrl;
