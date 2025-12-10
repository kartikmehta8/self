// SPDX-FileCopyrightText: 2025 Social Connect Labs, Inc.
// SPDX-License-Identifier: BUSL-1.1
// NOTE: Converts to Apache-2.0 on 2029-06-11 per LICENSE.

import React, { useCallback, useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { DocumentCatalog, DocumentMetadata, IDDocument } from '@selfxyz/common/utils/types';
import { loadSelectedDocument, useSelfClient } from '@selfxyz/mobile-sdk-alpha';
import { OnboardingNavigator } from '@selfxyz/mobile-sdk-alpha/navigators/onboarding/native-stack';

import HomeScreen from './src/screens/HomeScreen';
import type { ScreenContext, ScreenId } from './src/screens';
import { screenMap } from './src/screens';
import SelfClientProvider from './src/providers/SelfClientProvider';

type SelectedDocumentState = {
  data: IDDocument;
  metadata: DocumentMetadata;
};

// Define the root stack param list
type RootStackParamList = {
  Home: undefined;
  Generate: undefined;
  Register: undefined;
  Documents: undefined;
  Onboarding: undefined;
  // Add other screens as needed
};

export type RootNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const Stack = createNativeStackNavigator<RootStackParamList>();

// Map screen IDs to navigation routes
const getRouteNameFromScreenId = (screenId: ScreenId): keyof RootStackParamList | null => {
  switch (screenId) {
    case 'generate':
      return 'Generate';
    case 'register':
      return 'Register';
    case 'documents':
      return 'Documents';
    case 'onboarding':
      return 'Onboarding';
    case 'home':
      return 'Home';
    default:
      return null;
  }
};

function DemoAppScreens() {
  const selfClient = useSelfClient();

  const [catalog, setCatalog] = useState<DocumentCatalog>({ documents: [] });
  const [selectedDocument, setSelectedDocument] = useState<SelectedDocumentState | null>(null);

  const refreshDocuments = useCallback(async () => {
    try {
      const selected = await loadSelectedDocument(selfClient);
      const nextCatalog = await selfClient.loadDocumentCatalog();
      setCatalog(nextCatalog);
      setSelectedDocument(selected);
    } catch (error) {
      console.warn('Failed to refresh documents', error);
      setCatalog({ documents: [] });
      setSelectedDocument(null);
    }
  }, [selfClient]);

  useEffect(() => {
    refreshDocuments();
  }, [refreshDocuments]);

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
      initialRouteName="Home"
    >
      <Stack.Screen name="Home">
        {({ navigation }) => {
          const navigate = (screenId: ScreenId) => {
            const routeName = getRouteNameFromScreenId(screenId);
            if (routeName) {
              navigation.navigate(routeName as any);
            }
          };

          const goHome = () => navigation.navigate('Home');

          const screenContext: ScreenContext = {
            navigate,
            goHome,
            documentCatalog: catalog,
            selectedDocument,
            refreshDocuments,
          };

          return <HomeScreen screenContext={screenContext} />;
        }}
      </Stack.Screen>

      <Stack.Screen name="Onboarding" component={OnboardingNavigator} />

      <Stack.Screen name="Generate">
        {({ navigation }) => {
          const screenContext: ScreenContext = {
            navigate: (screenId: ScreenId) => {
              const routeName = getRouteNameFromScreenId(screenId);
              if (routeName) {
                navigation.navigate(routeName as any);
              }
            },
            goHome: () => navigation.navigate('Home'),
            documentCatalog: catalog,
            selectedDocument,
            refreshDocuments,
          };

          const descriptor = screenMap['generate'];
          const ScreenComponent = descriptor.load();
          const props = descriptor.getProps?.(screenContext) ?? {};
          return <ScreenComponent {...props} />;
        }}
      </Stack.Screen>

      <Stack.Screen name="Register">
        {({ navigation }) => {
          const screenContext: ScreenContext = {
            navigate: (screenId: ScreenId) => {
              const routeName = getRouteNameFromScreenId(screenId);
              if (routeName) {
                navigation.navigate(routeName as any);
              }
            },
            goHome: () => navigation.navigate('Home'),
            documentCatalog: catalog,
            selectedDocument,
            refreshDocuments,
          };

          const descriptor = screenMap['register'];
          const ScreenComponent = descriptor.load();
          const props = descriptor.getProps?.(screenContext) ?? {};
          return <ScreenComponent {...props} />;
        }}
      </Stack.Screen>

      <Stack.Screen name="Documents">
        {({ navigation }) => {
          const screenContext: ScreenContext = {
            navigate: (screenId: ScreenId) => {
              const routeName = getRouteNameFromScreenId(screenId);
              if (routeName) {
                navigation.navigate(routeName as any);
              }
            },
            goHome: () => navigation.navigate('Home'),
            documentCatalog: catalog,
            selectedDocument,
            refreshDocuments,
          };

          const descriptor = screenMap['documents'];
          const ScreenComponent = descriptor.load();
          const props = descriptor.getProps?.(screenContext) ?? {};
          return <ScreenComponent {...props} />;
        }}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

function App() {
  return (
    <NavigationContainer>
      <SelfClientProvider>
        <DemoAppScreens />
      </SelfClientProvider>
    </NavigationContainer>
  );
}

export default App;
