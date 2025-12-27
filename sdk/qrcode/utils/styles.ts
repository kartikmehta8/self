import React from 'react';

import { QRcodeSteps } from './utils.js';

// Color constants for border states
const BORDER_COLORS = {
  GRAY: '#E2E8F0', // Initial/Waiting state
  BLUE: '#3B82F6', // Connecting/Processing state
  RED: '#EF4444', // Failed state
  CYAN: '#01BFFF', // Success state
} as const;

/**
 * Get the border color based on the current QR code step
 * @param step - Current step in the authentication flow
 * @returns Hex color code for the border
 */
const getBorderColor = (step: number): string => {
  switch (step) {
    case QRcodeSteps.DISCONNECTED:
    case QRcodeSteps.WAITING_FOR_MOBILE:
      return BORDER_COLORS.GRAY;
    case QRcodeSteps.MOBILE_CONNECTED:
    case QRcodeSteps.PROOF_GENERATION_STARTED:
    case QRcodeSteps.PROOF_GENERATED:
      return BORDER_COLORS.BLUE;
    case QRcodeSteps.PROOF_GENERATION_FAILED:
      return BORDER_COLORS.RED;
    case QRcodeSteps.PROOF_VERIFIED:
      return BORDER_COLORS.CYAN;
    default:
      return BORDER_COLORS.GRAY;
  }
};

/**
 * Style for the animation overlay positioned over the QR code
 * @param imageSize - Size of the center image/animation
 */
export const qrAnimationOverlayStyle = (imageSize: number): React.CSSProperties => ({
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: imageSize,
  height: imageSize,
  pointerEvents: 'none',
});

/**
 * Style for the QR code container
 * @param size - Size of the QR code
 */
export const qrContainerStyle = (size: number): React.CSSProperties => ({
  position: 'relative',
  width: size,
  height: size,
});

/**
 * Style for the main wrapper containing the QR code and status banner
 * @param step - Current step in the authentication flow
 * @param showBorder - Whether to display the colored border
 */
export const qrWrapperStyle = (step: number, showBorder: boolean = true): React.CSSProperties => ({
  display: 'inline-flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '6px',
  padding: '3px',
  borderRadius: '10px',
  border: showBorder ? `6px solid ${getBorderColor(step)}` : 'none',
  backgroundColor: '#FFF',
  transition: 'border-color 0.3s ease',
});

/**
 * Style for the logo in the status banner
 */
export const statusBannerLogoStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  marginRight: 8,
};

/**
 * Style for the status banner below the QR code
 * @param qrSize - Size of the QR code (banner width matches QR code width)
 */
export const statusBannerStyle = (qrSize: number): React.CSSProperties => ({
  backgroundColor: '#000',
  color: '#fff',
  borderRadius: '5px',
  width: qrSize,
  fontWeight: '700',
  fontSize: '18px',
  height: '50px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});
