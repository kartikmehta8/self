import Lottie from 'lottie-react';
import type { LottieComponentProps } from 'lottie-react';
import { QRCodeSVG } from 'qrcode.react';
import React from 'react';

import { qrAnimationOverlayStyle, qrContainerStyle } from '../utils/styles.js';
import { getStatusAnimation, getStatusIcon, QRcodeSteps } from '../utils/utils.js';

// Handle both default and named exports from lottie-react
const LottieComponent = (Lottie.default || Lottie) as React.ComponentType<LottieComponentProps>;

// Constants
const QR_IMAGE_SIZE_RATIO = 0.32; // 32% of QR code size for the center image

interface QRCodeProps {
  value: string;
  size: number;
  darkMode: boolean;
  proofStep: number;
}

const QRCodeComponent: React.FC<QRCodeProps> = ({ value, size, darkMode, proofStep }) => {
  const isInitialState =
    proofStep === QRcodeSteps.DISCONNECTED || proofStep === QRcodeSteps.WAITING_FOR_MOBILE;

  const isConnectingState =
    proofStep === QRcodeSteps.MOBILE_CONNECTED ||
    proofStep === QRcodeSteps.PROOF_GENERATION_STARTED ||
    proofStep === QRcodeSteps.PROOF_GENERATED;

  const showAnimation = !isInitialState;

  const statusIcon = getStatusIcon(proofStep);
  const bgColor = darkMode ? '#000000' : '#ffffff';
  const fgColor = darkMode ? '#ffffff' : '#000000';
  const imageSize = size * QR_IMAGE_SIZE_RATIO;

  return (
    <div style={qrContainerStyle(size)}>
      <QRCodeSVG
        value={value}
        size={size}
        bgColor={bgColor}
        fgColor={fgColor}
        level="H"
        imageSettings={
          statusIcon
            ? {
                src: statusIcon,
                height: imageSize,
                width: imageSize,
                excavate: true,
              }
            : undefined
        }
      />
      {showAnimation && (
        <div style={qrAnimationOverlayStyle(imageSize)}>
          <LottieComponent
            animationData={getStatusAnimation(proofStep)}
            loop={isConnectingState}
            speed={1}
          />
        </div>
      )}
    </div>
  );
};

// Memoize to prevent unnecessary re-renders
const QRCode = React.memo(QRCodeComponent);

export default QRCode;
