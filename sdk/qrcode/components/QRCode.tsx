import Lottie from 'lottie-react';
import { QRCodeSVG } from 'qrcode.react';
import React from 'react';

import { qrAnimationOverlayStyle, qrContainerStyle } from '../utils/styles.js';
import { getStatusAnimation, getStatusIcon, QRcodeSteps } from '../utils/utils.js';

const LottieComponent = Lottie.default || Lottie;

interface QRCodeProps {
  value: string;
  size: number;
  darkMode: boolean;
  proofStep: number;
}

const QRCode: React.FC<QRCodeProps> = ({ value, size, darkMode, proofStep }) => {
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
  const imageSize = size * 0.32;

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
          {/* @ts-expect-error Lottie typings don't match the default export shape */}
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

export default QRCode;
