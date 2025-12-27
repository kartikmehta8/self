import type { SelfApp } from '@selfxyz/sdk-common';
import { getUniversalLink, REDIRECT_URL, WS_DB_RELAYER } from '@selfxyz/sdk-common';
import React, { useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { qrWrapperStyle } from '../utils/styles.js';
import { QRcodeSteps } from '../utils/utils.js';
import { initWebSocket } from '../utils/websocket.js';
import QRCode from './QRCode.js';
import StatusBanner from './StatusBanner.js';

/**
 * Props for the SelfQRcode component
 */
interface SelfQRcodeProps {
  /** Self application configuration */
  selfApp: SelfApp;
  /** Callback invoked when authentication succeeds */
  onSuccess: () => void;
  /** Callback invoked when authentication fails */
  onError: (data: { error_code?: string; reason?: string }) => void;
  /** Connection type: 'websocket' for real-time or 'deeplink' for deferred authentication */
  type?: 'websocket' | 'deeplink';
  /** WebSocket server URL (only used when type is 'websocket') */
  websocketUrl?: string;
  /** QR code size in pixels */
  size?: number;
  /** Whether to use dark mode styling */
  darkMode?: boolean;
  /** Whether to display the animated colored border */
  showBorder?: boolean;
  /** Whether to display the status text banner */
  showStatusText?: boolean;
}

/**
 * Wrapper component that ensures client-side rendering for the QR code
 * This prevents SSR issues with browser-specific APIs
 */
const SelfQRcodeWrapper = (props: SelfQRcodeProps) => {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return null;
  }
  return <SelfQRcode {...props} />;
};

/**
 * Self QR Code Component
 * 
 * Displays an animated QR code for Self authentication with real-time status updates.
 * Supports both WebSocket and deeplink connection modes.
 * 
 * @example
 * ```tsx
 * <SelfQRcode
 *   selfApp={myApp}
 *   onSuccess={() => console.log('Authenticated!')}
 *   onError={(err) => console.error(err)}
 *   size={300}
 *   showBorder={true}
 *   showStatusText={true}
 * />
 * ```
 */
const SelfQRcode = ({
  selfApp,
  onSuccess,
  onError,
  type = 'websocket',
  websocketUrl = WS_DB_RELAYER,
  size = 300,
  darkMode = false,
  showBorder = true,
  showStatusText = true,
}: SelfQRcodeProps) => {
  const [proofStep, setProofStep] = useState(QRcodeSteps.WAITING_FOR_MOBILE);
  const [sessionId, setSessionId] = useState('');
  const socketRef = useRef<ReturnType<typeof initWebSocket> | null>(null);

  useEffect(() => {
    setSessionId(uuidv4());
  }, []);

  useEffect(() => {
    if (sessionId && !socketRef.current) {
      socketRef.current = initWebSocket(
        websocketUrl,
        {
          ...selfApp,
          sessionId: sessionId,
        },
        type,
        setProofStep,
        onSuccess,
        onError
      );
    }

    return () => {
      if (socketRef.current) {
        socketRef.current();
        socketRef.current = null;
      }
    };
  }, [sessionId, type, websocketUrl, onSuccess, selfApp]);

  if (!sessionId) {
    return null;
  }

  const qrValue =
    type === 'websocket'
      ? `${REDIRECT_URL}?sessionId=${sessionId}`
      : getUniversalLink({
          ...selfApp,
          sessionId: sessionId,
        });

  return (
    <div
      style={qrWrapperStyle(proofStep, showBorder)}
      role="img"
      aria-label="Self authentication QR code"
    >
      <QRCode value={qrValue} size={size} darkMode={darkMode} proofStep={proofStep} />
      {showStatusText && <StatusBanner proofStep={proofStep} qrSize={size} />}
    </div>
  );
};

// Also export other components/types that might be needed
export { SelfQRcode, SelfQRcodeWrapper };
