// SPDX-FileCopyrightText: 2025 Social Connect Labs, Inc.
// SPDX-License-Identifier: BUSL-1.1
// NOTE: Converts to Apache-2.0 on 2029-06-11 per LICENSE.

import React, { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { YStack } from 'tamagui';

import { useSelfClient } from '@selfxyz/mobile-sdk-alpha';
import { PrimaryButton } from '@selfxyz/mobile-sdk-alpha/components';
import { BackupEvents } from '@selfxyz/mobile-sdk-alpha/constants/analytics';
import {
  black,
  blue600,
  white,
} from '@selfxyz/mobile-sdk-alpha/constants/colors';
import { advercase, dinot } from '@selfxyz/mobile-sdk-alpha/constants/fonts';

import RestoreAccountSvg from '@/assets/icons/restore_account.svg';
import useHapticNavigation from '@/hooks/useHapticNavigation';

const AccountRestoreScreen: React.FC = () => {
  const navigateToAccountRecovery = useHapticNavigation(
    'AccountRecoveryChoice',
    {
      params: {
        restoreAllDocuments: true,
      },
    },
  );
  const navigateToCountryPicker = useHapticNavigation('CountryPicker');
  const { loadDocumentCatalog } = useSelfClient();

  const hasUnregisteredDocuments = useCallback(async () => {
    const catalog = await loadDocumentCatalog();
    return catalog.documents.some(
      doc => !doc.isRegistered && doc.mock === false,
    );
  }, [loadDocumentCatalog]);

  const onRestoreAccountPress = useCallback(async () => {
    const value = await hasUnregisteredDocuments();
    if (value) {
      navigateToAccountRecovery();
    } else {
      navigateToCountryPicker();
    }
  }, [
    hasUnregisteredDocuments,
    navigateToAccountRecovery,
    navigateToCountryPicker,
  ]);

  return (
    <YStack flex={1} backgroundColor={white}>
      <YStack
        flex={1}
        alignItems="center"
        justifyContent="center"
        paddingHorizontal={20}
        paddingBottom={20}
      >
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <RestoreAccountSvg height={56} width={56} color={white} />
          </View>

          <View style={styles.descriptionContainer}>
            <Text style={styles.title}>Restore your account</Text>
            <Text style={styles.description}>
              Restore your Self account using your recovery phrase or cloud
              backup.
            </Text>
          </View>

          <View style={styles.optionsContainer}>
            <PrimaryButton
              trackEvent={BackupEvents.ACCOUNT_RECOVERY_STARTED}
              onPress={onRestoreAccountPress}
            >
              Restore my account
            </PrimaryButton>
          </View>
        </View>
      </YStack>
    </YStack>
  );
};

const styles = StyleSheet.create({
  content: {
    width: '100%',
    alignItems: 'center',
    gap: 30,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: blue600,
  },
  descriptionContainer: {
    width: '100%',
    gap: 12,
    alignItems: 'center',
  },
  title: {
    width: '100%',
    fontSize: 28,
    letterSpacing: 1,
    fontFamily: advercase,
    color: black,
    textAlign: 'center',
  },
  description: {
    width: '100%',
    fontSize: 18,
    fontWeight: '500',
    fontFamily: dinot,
    color: black,
    textAlign: 'center',
  },
  optionsContainer: {
    width: '100%',
    gap: 10,
  },
});

export default AccountRestoreScreen;
