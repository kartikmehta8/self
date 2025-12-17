// SPDX-FileCopyrightText: 2025 Social Connect Labs, Inc.
// SPDX-License-Identifier: BUSL-1.1
// NOTE: Converts to Apache-2.0 on 2029-06-11 per LICENSE.

import React from 'react';
import { Text, View, XStack, YStack } from 'tamagui';

import {
  cyan300,
  red500,
  slate400,
  slate600,
  white,
  zinc500,
  zinc900,
} from '@selfxyz/mobile-sdk-alpha/constants/colors';
import { advercase, dinot } from '@selfxyz/mobile-sdk-alpha/constants/fonts';

import type { MultichainStatus } from '@/stores/proofTypes';

interface MultichainProgressProps {
  status: MultichainStatus;
}

interface StepIndicatorProps {
  label: string;
  status: 'pending' | 'in_progress' | 'complete' | 'failed';
  detail?: string;
  isLast?: boolean;
}

const StepIndicator: React.FC<StepIndicatorProps> = ({
  label,
  status,
  detail,
  isLast,
}) => {
  const getStatusColor = () => {
    switch (status) {
      case 'complete':
        return cyan300;
      case 'failed':
        return red500;
      case 'in_progress':
        return slate400;
      case 'pending':
      default:
        return zinc500;
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'complete':
        return '✓';
      case 'failed':
        return '✗';
      case 'in_progress':
        return '◉';
      case 'pending':
      default:
        return '○';
    }
  };

  return (
    <YStack gap={8}>
      <XStack gap={12} alignItems="center">
        <View
          width={24}
          height={24}
          borderRadius={12}
          backgroundColor={getStatusColor()}
          alignItems="center"
          justifyContent="center"
        >
          <Text
            color={white}
            fontSize={14}
            fontFamily={dinot}
            fontWeight="bold"
          >
            {getStatusIcon()}
          </Text>
        </View>
        <YStack flex={1}>
          <Text
            color={white}
            fontSize={15}
            fontFamily={dinot}
            fontWeight={status === 'in_progress' ? 'bold' : 'normal'}
          >
            {label}
          </Text>
          {detail && (
            <Text
              color={slate400}
              fontSize={12}
              fontFamily={dinot}
              marginTop={4}
            >
              {detail}
            </Text>
          )}
        </YStack>
      </XStack>
      {!isLast && (
        <View
          width={2}
          height={24}
          backgroundColor={slate600}
          marginLeft={11}
        />
      )}
    </YStack>
  );
};

export const MultichainProgress: React.FC<MultichainProgressProps> = ({
  status,
}) => {
  // Error handling for scope query failure
  if (
    status.origin.status === 'failed' &&
    status.bridge.detail?.includes('scope()')
  ) {
    const match = status.bridge.detail.match(
      /(\w+\.scope\(\)) on chain (\d+) failed/,
    );
    if (match) {
      return (
        <YStack
          backgroundColor={zinc900}
          padding={20}
          borderRadius={16}
          gap={12}
        >
          <Text
            color={red500}
            fontSize={18}
            fontFamily={advercase}
            fontWeight="bold"
          >
            Verification Failed
          </Text>
          <Text color={white} fontSize={14} fontFamily={dinot}>
            {match[1]} on chain {match[2]} failed
          </Text>
          <Text color={slate400} fontSize={13} fontFamily={dinot}>
            Please contact dApp support
          </Text>
        </YStack>
      );
    }
  }

  // Error handling for fee estimation failure
  if (status.bridge.detail?.includes('fee estimation failed')) {
    return (
      <YStack backgroundColor={zinc900} padding={20} borderRadius={16} gap={12}>
        <Text
          color={red500}
          fontSize={18}
          fontFamily={advercase}
          fontWeight="bold"
        >
          Bridge Fee Estimation Failed
        </Text>
        <Text color={white} fontSize={14} fontFamily={dinot}>
          Unable to calculate bridge cost. Please try again.
        </Text>
      </YStack>
    );
  }

  // Normal 3-step progress
  const steps = [
    {
      label: 'Verifying on Celo',
      status: status.origin.status,
      detail: status.origin.txHash
        ? `Tx: ${status.origin.txHash.slice(0, 10)}...`
        : undefined,
    },
    {
      label: `Bridging to ${status.destChainName || 'destination chain'}`,
      status: status.bridge.status,
      detail: status.bridge.detail || status.bridge.eta,
    },
    {
      label: 'Delivered',
      status: status.destination.status,
      detail: status.destination.txHash
        ? `Tx: ${status.destination.txHash.slice(0, 10)}...`
        : undefined,
    },
  ];

  // Calculate current step for display
  const getCurrentStep = (): number => {
    if (status.destination.status === 'complete') return 3;
    if (
      status.bridge.status === 'complete' ||
      status.bridge.status === 'in_progress'
    )
      return 2;
    if (status.origin.status === 'complete') return 2;
    return 1;
  };

  const currentStep = getCurrentStep();
  const totalSteps = 3;

  return (
    <YStack backgroundColor={zinc900} padding={20} borderRadius={16} gap={16}>
      <YStack gap={4}>
        <Text color={white} fontSize={20} fontFamily={advercase}>
          Multichain Verification
        </Text>
        <Text color={slate400} fontSize={14} fontFamily={dinot}>
          Step {currentStep} of {totalSteps}
        </Text>
      </YStack>

      <YStack gap={0}>
        {steps.map((step, i) => (
          <StepIndicator
            key={i}
            label={step.label}
            status={step.status}
            detail={step.detail}
            isLast={i === steps.length - 1}
          />
        ))}
      </YStack>

      {status.bridge.protocol && (
        <Text
          color={zinc500}
          fontSize={11}
          fontFamily={dinot}
          textAlign="center"
          marginTop={8}
        >
          Via{' '}
          {status.bridge.protocol === 'layerzero' ? 'LayerZero' : 'Wormhole'}
        </Text>
      )}
    </YStack>
  );
};
