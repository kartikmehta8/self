// SPDX-FileCopyrightText: 2025 Social Connect Labs, Inc.
// SPDX-License-Identifier: BUSL-1.1
// NOTE: Converts to Apache-2.0 on 2029-06-11 per LICENSE.

import { sha256 } from '@noble/hashes/sha256';
import type { PropsWithChildren } from 'react';
import React, { useMemo } from 'react';
import { useNavigation } from '@react-navigation/native';

import {
  SelfClientProvider as SdkSelfClientProvider,
  createListenersMap,
  SdkEvents,
  type Adapters,
  type RouteName,
  type TrackEventParams,
  type WsConn,
  reactNativeScannerAdapter,
} from '@selfxyz/mobile-sdk-alpha';

import { persistentDocumentsAdapter } from '../utils/documentStore';
import { getOrCreateSecret } from '../utils/secureStorage';

// Define app screen names
type AppScreenName = 'Home' | 'Onboarding' | 'Generate' | 'Register' | 'Documents';

/**
 * Maps SDK RouteName values to demo app screen names.
 * Routes not in this map are not supported in the demo app.
 */
const ROUTE_TO_SCREEN_MAP: Partial<Record<RouteName, AppScreenName>> = {
  Home: 'Home',
  CountryPicker: 'Onboarding',
  IDPicker: 'Onboarding',
  DocumentCamera: 'Onboarding',
  DocumentNFCScan: 'Onboarding',
  ManageDocuments: 'Documents',
  // Routes not implemented in demo app:
  // 'DocumentOnboarding': null,
  // 'SaveRecoveryPhrase': null,
  // 'AccountRecoveryChoice': null,
  // 'ComingSoon': null,
  // 'DocumentDataNotFound': null,
  // 'Settings': null,
  // 'AccountVerifiedSuccess': null,
} as const;

/**
 * Translates SDK RouteName to demo app screen name.
 *
 * @param routeName - The route name from the SDK
 * @returns The corresponding demo app screen name, or null if not supported
 */
function translateRouteToScreen(routeName: RouteName): AppScreenName | null {
  return ROUTE_TO_SCREEN_MAP[routeName] ?? null;
}

const createFetch = () => {
  const fetchImpl = globalThis.fetch;
  if (!fetchImpl) {
    return async () => {
      throw new Error('Fetch is not available in this environment. Provide a fetch polyfill.');
    };
  }

  return (input: RequestInfo | URL, init?: RequestInit) => fetchImpl(input, init);
};

const createWsAdapter = () => {
  const WebSocketImpl = globalThis.WebSocket;

  if (!WebSocketImpl) {
    return {
      connect: () => {
        throw new Error('WebSocket is not available in this environment. Provide a WebSocket implementation.');
      },
    };
  }

  return {
    connect: (url: string, opts?: { signal?: AbortSignal; headers?: Record<string, string> }): WsConn => {
      const socket = new WebSocketImpl(url);

      let abortHandler: (() => void) | null = null;

      if (opts?.signal) {
        abortHandler = () => {
          socket.close();
        };

        if (typeof opts.signal.addEventListener === 'function') {
          opts.signal.addEventListener('abort', abortHandler, { once: true });
        }
      }

      const attach = (event: 'message' | 'error' | 'close', handler: (payload?: any) => void) => {
        // Clean up abort listener when socket closes
        if (event === 'close' && abortHandler && opts?.signal) {
          const originalHandler = handler;
          handler = (payload?: any) => {
            if (typeof opts.signal!.removeEventListener === 'function') {
              opts.signal!.removeEventListener('abort', abortHandler!);
            }
            originalHandler(payload);
          };
        }

        if (typeof socket.addEventListener === 'function') {
          if (event === 'message') {
            (socket.addEventListener as any)('message', handler as any);
          } else if (event === 'error') {
            (socket.addEventListener as any)('error', handler as any);
          } else {
            (socket.addEventListener as any)('close', handler as any);
          }
        } else {
          if (event === 'message') {
            (socket as any).onmessage = handler;
          } else if (event === 'error') {
            (socket as any).onerror = handler;
          } else {
            (socket as any).onclose = handler;
          }
        }
      };

      return {
        send: (data: string | ArrayBufferView | ArrayBuffer) => socket.send(data),
        close: () => socket.close(),
        onMessage: cb => {
          attach('message', event => {
            // React Native emits { data }, whereas browsers emit MessageEvent.
            const payload = (event as { data?: unknown }).data ?? event;
            cb(payload);
          });
        },
        onError: cb => {
          attach('error', error => cb(error));
        },
        onClose: cb => {
          attach('close', () => cb());
        },
      };
    },
  };
};

const hash = (data: Uint8Array): Uint8Array => sha256(data);

type SelfClientProviderProps = PropsWithChildren<{
  onNavigate?: (screen: string) => void;
}>;

export function SelfClientProvider({ children, onNavigate }: SelfClientProviderProps) {
  const config = useMemo(() => ({}), []);
  const navigation = useNavigation();

  const adapters: Adapters = useMemo(
    () => ({
      scanner: reactNativeScannerAdapter,
      network: {
        http: {
          fetch: createFetch(),
        },
        ws: createWsAdapter(),
      },
      navigation: {
        goBack: () => {
          if (navigation.canGoBack()) {
            navigation.goBack();
          }
        },
        goTo: (routeName, params) => {
          const screenName = translateRouteToScreen(routeName);
          if (screenName) {
            (navigation.navigate as any)(screenName, params);
          } else {
            console.warn(
              `[SelfClientProvider] SDK route "${routeName}" is not mapped to a demo screen. Ignoring navigation request.`,
            );
          }
        },
      },
      documents: persistentDocumentsAdapter,
      crypto: {
        async hash(data: Uint8Array): Promise<Uint8Array> {
          return hash(data);
        },
        async sign(_data: Uint8Array, _keyRef: string): Promise<Uint8Array> {
          throw new Error('Signing is not supported in the demo client.');
        },
      },
      analytics: {
        trackEvent: (_event: string, _payload?: TrackEventParams) => {
          // No-op analytics for the demo application
        },
      },
      auth: {
        async getPrivateKey(): Promise<string | null> {
          try {
            const secret = await getOrCreateSecret();
            // Ensure the secret is 0x-prefixed for components expecting hex strings
            return secret.startsWith('0x') ? secret : `0x${secret}`;
          } catch (error) {
            console.error('Failed to get/create secret:', error);
            return null;
          }
        },
      },
    }),
    [navigation],
  );

  const listeners = useMemo(() => {
    const { map, addListener } = createListenersMap();

    // Navigation within the onboarding flow is now handled by the SDK's OnboardingNavigator
    // We only need to handle navigation events that go outside the onboarding flow

    // Example: Navigate back to home after successful document scan
    addListener(SdkEvents.DOCUMENT_NFC_SCAN_SUCCESS, () => {
      // Could navigate to a success screen or back to home
      // For now, let the onboarding navigator handle it
      console.log('[Demo] Document NFC scan successful');
    });

    return map;
  }, []);

  return (
    <SdkSelfClientProvider config={config} adapters={adapters} listeners={listeners}>
      {children}
    </SdkSelfClientProvider>
  );
}

export default SelfClientProvider;
