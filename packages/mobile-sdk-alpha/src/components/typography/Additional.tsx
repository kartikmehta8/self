// SPDX-FileCopyrightText: 2025 Social Connect Labs, Inc.
// SPDX-License-Identifier: BUSL-1.1
// NOTE: Converts to Apache-2.0 on 2029-06-11 per LICENSE.

import { forwardRef } from 'react';
import type { TamaguiTextElement, TextProps } from 'tamagui';
import { Text } from 'tamagui';

import { slate400 } from '../../constants/colors';
import { useTypographyTheme } from './context';

export const Additional = forwardRef<TamaguiTextElement, TextProps>((props, ref) => {
  const { fonts } = useTypographyTheme();
  return (
    <Text
      ref={ref}
      fontSize={14}
      lineHeight={18}
      textAlign="center"
      color={slate400}
      marginTop={10}
      fontFamily={fonts.body}
      textTransform="none"
      {...props}
    />
  );
});

Additional.displayName = 'Additional';
