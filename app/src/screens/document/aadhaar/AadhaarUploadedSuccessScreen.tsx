// SPDX-FileCopyrightText: 2025 Social Connect Labs, Inc.
// SPDX-License-Identifier: BUSL-1.1
// NOTE: Converts to Apache-2.0 on 2029-06-11 per LICENSE.

import React from 'react';
import { XStack, YStack } from 'tamagui';
import { useNavigation } from '@react-navigation/native';

import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { BodyText } from '@/components/typography/BodyText';
import { Title } from '@/components/typography/Title';
import BlueCheckIcon from '@/images/blue_check.svg';
import { useSafeAreaInsets } from '@/mocks/react-native-safe-area-context';
import {
  black,
  slate50,
  slate100,
  slate200,
  slate300,
  slate400,
  slate500,
  white,
} from '@/utils/colors';
import { extraYPadding } from '@/utils/constants';

const AadhaarUploadedSuccessScreen: React.FC = () => {
  const { bottom } = useSafeAreaInsets();
  const navigation = useNavigation();

  return (
    <YStack flex={1} backgroundColor={slate100}>
      <YStack flex={1} paddingHorizontal={20} paddingTop={20}>
        <YStack
          flex={1}
          justifyContent="center"
          alignItems="center"
          paddingVertical={20}
        >
          <BlueCheckIcon width={120} height={120} />
        </YStack>
      </YStack>

      <YStack
        paddingHorizontal={20}
        paddingTop={20}
        alignItems="center"
        paddingVertical={25}
        borderBlockWidth={1}
        borderBlockColor={slate200}
      >
        <BodyText fontSize={19} textAlign="center" color={black}>
          QR code upload successful
        </BodyText>
        <BodyText
          marginTop={6}
          fontSize={17}
          textAlign="center"
          color={slate500}
        >
          You are ready to register your Aadhaar card with Self.
        </BodyText>
      </YStack>

      <YStack
        paddingHorizontal={25}
        backgroundColor={white}
        paddingBottom={bottom + extraYPadding + 35}
        paddingTop={25}
      >
        <PrimaryButton
          onPress={() => {
            // TODO: Navigate to RFID scanning screen
            console.log('Continue to RFID scanning');
            navigation.navigate('ConfirmBelonging', {});
          }}
        >
          Continue
        </PrimaryButton>
      </YStack>
    </YStack>
  );
};

export default AadhaarUploadedSuccessScreen;
