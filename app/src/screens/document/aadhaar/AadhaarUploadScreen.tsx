// SPDX-FileCopyrightText: 2025 Social Connect Labs, Inc.
// SPDX-License-Identifier: BUSL-1.1
// NOTE: Converts to Apache-2.0 on 2029-06-11 per LICENSE.

import React from 'react';
import { Button, XStack, YStack , Text, Image} from 'tamagui';

import { black, slate100, slate200, slate300, slate400, slate50, slate500, white } from '@/utils/colors';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { Title } from '@/components/typography/Title';
import { useSafeAreaInsets } from '@/mocks/react-native-safe-area-context';
import { extraYPadding } from '@/utils/constants';
import ScanIcon from '@/images/icons/qr_scan.svg';
import { BodyText } from '@/components/typography/BodyText';
import AadhaarImage from '@/images/512w.png';

const AadhaarUploadScreen: React.FC = () => {
  const { bottom } = useSafeAreaInsets();

  return (
    <YStack flex={1} backgroundColor={slate100} >
      <YStack flex={1} paddingHorizontal={20} paddingTop={20}>
        <YStack flex={1} justifyContent="center" alignItems="center" paddingVertical={20}>
          <Image
            source={AadhaarImage}
            width="100%"
            height="100%"
            objectFit="contain"
          />
        </YStack>
      </YStack>

      <YStack paddingHorizontal={20} paddingTop={20} alignItems="center" paddingVertical={25} borderBlockWidth={1} borderBlockColor={slate200}>
      <BodyText fontWeight="bold" fontSize={18} textAlign="center">Generate a QR code from the mAadaar app</BodyText>
      <BodyText  fontSize={16} textAlign="center" color={slate500}>Save the QR code to your photo library
      and upload it here.</BodyText>
      <BodyText fontSize={12} textAlign="center" color={slate400} marginTop={20}>SELF DOES NOT STORE THIS INFORMATION.</BodyText>
      </YStack>

      <YStack paddingHorizontal={25} backgroundColor={white} paddingBottom={bottom + extraYPadding + 35} paddingTop={25}>
        <XStack gap="$3" alignItems="stretch">
          <YStack flex={1}>
            <PrimaryButton>Upload QR code</PrimaryButton>
          </YStack>
          <Button
            aspectRatio={1}

            backgroundColor={slate200}
            borderRadius="$2"
            justifyContent="center"
            alignItems="center"
            pressStyle={{
              backgroundColor: slate50,
              scale: 0.98,
            }}
            hoverStyle={{
              backgroundColor: slate300,
            }}
            onPress={() => {
              // Handle QR scanner action
              console.log('Open QR scanner');
            }}
          >
            <ScanIcon width={28} height={28} color={black} />
          </Button>
        </XStack>
      </YStack>
    </YStack>
  );
};

export default AadhaarUploadScreen;
