// SPDX-FileCopyrightText: 2025 Social Connect Labs, Inc.
// SPDX-License-Identifier: BUSL-1.1
// NOTE: Converts to Apache-2.0 on 2029-06-11 per LICENSE.

import React, { useEffect } from 'react';

import { useSelfClient } from '../../context';
import CountryPickerScreen from '../../flows/onboarding/country-picker-screen';
import { DocumentCameraScreen } from '../../flows/onboarding/document-camera-screen';
import { DocumentNFCScreen } from '../../flows/onboarding/document-nfc-screen';
import IDSelectionScreen from '../../flows/onboarding/id-selection-screen';
import { SdkEvents } from '../../types/events';

import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

export type OnboardingNavigationProp = NativeStackNavigationProp<OnboardingStackParamList>;

export type OnboardingStackParamList = {
  CountryPicker: undefined;
  IDSelection: {
    countryCode: string;
    countryName: string;
    documentTypes: string[];
  };
  DocumentCamera: {
    documentType?: string;
  };
  DocumentNFC: undefined;
};

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

/**
 * Event listener component that bridges SDK events to react-navigation
 * Must be rendered inside a screen to access navigation context
 */
function OnboardingNavigationHandler({ children }: { children: React.ReactNode }) {
  const navigation = useNavigation<OnboardingNavigationProp>();
  const selfClient = useSelfClient();

  useEffect(() => {
    const unsubscribers = [
      // When country is selected, navigate to ID selection or camera
      selfClient.on(SdkEvents.DOCUMENT_COUNTRY_SELECTED, payload => {
        if (!payload) return;
        const { countryCode, countryName, documentTypes } = payload;
        if (documentTypes.length === 1) {
          // Skip ID selection if only one document type available
          navigation.navigate('DocumentCamera', { documentType: documentTypes[0] });
        } else {
          navigation.navigate('IDSelection', { countryCode, countryName, documentTypes });
        }
      }),

      // When document type is selected, navigate to camera
      selfClient.on(SdkEvents.DOCUMENT_TYPE_SELECTED, payload => {
        if (!payload) return;
        const { documentType } = payload;
        navigation.navigate('DocumentCamera', { documentType });
      }),

      // Add handlers for other navigation events as needed
    ];

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [navigation, selfClient]);

  return <>{children}</>;
}

/**
 * Onboarding flow navigator using React Navigation native stack
 *
 * This navigator handles the document verification onboarding flow:
 * 1. Country selection
 * 2. ID type selection (if multiple types available)
 * 3. Document camera scan (MRZ)
 * 4. NFC scan (optional)
 *
 * @example
 * ```tsx
 * import { OnboardingNavigator } from '@selfxyz/mobile-sdk-alpha/navigators/onboarding/native-stack';
 *
 * <Stack.Navigator>
 *   <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
 * </Stack.Navigator>
 * ```
 */
export function OnboardingNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        gestureEnabled: true,
      }}
    >
      <Stack.Screen name="CountryPicker">
        {() => (
          <OnboardingNavigationHandler>
            <CountryPickerScreen insets={{ top: 0, bottom: 0 }} />
          </OnboardingNavigationHandler>
        )}
      </Stack.Screen>

      <Stack.Screen name="IDSelection">
        {({ route }) => (
          <OnboardingNavigationHandler>
            <IDSelectionScreen countryCode={route.params.countryCode} documentTypes={route.params.documentTypes} />
          </OnboardingNavigationHandler>
        )}
      </Stack.Screen>

      <Stack.Screen name="DocumentCamera">
        {() => (
          <OnboardingNavigationHandler>
            <DocumentCameraScreen safeAreaInsets={{ top: 0, bottom: 0 }} />
          </OnboardingNavigationHandler>
        )}
      </Stack.Screen>

      <Stack.Screen name="DocumentNFC">
        {() => (
          <OnboardingNavigationHandler>
            <DocumentNFCScreen safeAreaInsets={{ top: 0, bottom: 0 }} />
          </OnboardingNavigationHandler>
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

OnboardingNavigator.displayName = 'OnboardingNavigator';
