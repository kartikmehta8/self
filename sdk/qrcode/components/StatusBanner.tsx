import React from 'react';

import selfLogo from '../assets/self-logo.svg';
import { statusBannerLogoStyle, statusBannerStyle } from '../utils/styles.js';
import { getStatusText, QRcodeSteps } from '../utils/utils.js';

interface StatusBannerProps {
  proofStep: number;
  qrSize: number;
}

const StatusBanner: React.FC<StatusBannerProps> = ({ proofStep, qrSize }) => {
  const showLogo =
    proofStep === QRcodeSteps.DISCONNECTED || proofStep === QRcodeSteps.WAITING_FOR_MOBILE;

  return (
    <div style={statusBannerStyle(qrSize)}>
      {showLogo && <img src={selfLogo} alt="Self Logo" style={statusBannerLogoStyle} />}
      {getStatusText(proofStep)}
    </div>
  );
};

export default StatusBanner;
