// SPDX-FileCopyrightText: 2025 Social Connect Labs, Inc.
// SPDX-License-Identifier: BUSL-1.1
// NOTE: Converts to Apache-2.0 on 2029-06-11 per LICENSE.

import { forwardRef } from 'react';
import type { TamaguiTextElement, TextProps } from 'tamagui';
import { Text } from 'tamagui';

import { slate400 } from '../../constants/colors';
import { useTypographyTheme } from './context';

interface CaptionProps extends TextProps {
  size?: 'default' | 'small' | 'large';
}

export const Caption = forwardRef<TamaguiTextElement, CaptionProps>(({ size = 'default', ...props }, ref) => {
  const { fonts } = useTypographyTheme();
  const fontSize = size === 'small' ? 14 : size === 'large' ? 16 : 15;

  return <Text ref={ref} fontFamily={fonts.body} fontSize={fontSize} color={slate400} {...props} />;
});

Caption.displayName = 'Caption';
