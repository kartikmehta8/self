// SPDX-FileCopyrightText: 2025 Social Connect Labs, Inc.
// SPDX-License-Identifier: BUSL-1.1
// NOTE: Converts to Apache-2.0 on 2029-06-11 per LICENSE.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { getSKIPEM, initPassportDataParsing } from '@selfxyz/common';
import { storePassportData, useSelfClient, type NFCScanResult } from '@selfxyz/mobile-sdk-alpha';

import ScreenLayout from '../components/ScreenLayout';

type Props = {
  onBack: () => void;
  onNavigate: (screen: string, params?: any) => void;
};

export default function DocumentNFCScan({ onBack, onNavigate }: Props) {
  const selfClient = useSelfClient();
  const mrzData = selfClient.useMRZStore(state => state.getMRZ());

  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const scanCancelledRef = useRef(false);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasAutoStartedRef = useRef(false);

  const handleCancel = useCallback(() => {
    scanCancelledRef.current = true;
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    setIsScanning(false);
    onBack();
  }, [onBack]);

  const handleStartScan = useCallback(async () => {
    setIsScanning(true);
    setError(null);
    setStatusMessage('Hold your device near the NFC chip...');
    scanCancelledRef.current = false;

    const scanStartTime = Date.now();

    // Set timeout for scan
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }

    scanTimeoutRef.current = setTimeout(() => {
      scanCancelledRef.current = true;
      setStatusMessage(null);
      setError('Scan timed out');
      Alert.alert('Scan Timed Out', 'Please try again.', [
        {
          text: 'Try Again',
          onPress: () => {
            setError(null);
            handleStartScan();
          },
        },
        { text: 'Cancel', onPress: handleCancel, style: 'cancel' },
      ]);
      setIsScanning(false);
    }, 30000); // 30 second timeout

    try {
      // Scan the document using the SDK
      const scanResult = await selfClient.scanNFC({
        passportNumber: mrzData.documentNumber,
        dateOfBirth: mrzData.dateOfBirth,
        dateOfExpiry: mrzData.dateOfExpiry,
        sessionId: `nfc-scan-${Date.now()}`,
      });

      // Check if scan was cancelled
      if (scanCancelledRef.current) {
        return;
      }

      const scanDurationSeconds = ((Date.now() - scanStartTime) / 1000).toFixed(2);
      console.log('NFC Scan Successful - Duration:', scanDurationSeconds, 'seconds');

      setStatusMessage('Processing document data...');

      // Parse the passport data
      const skiPem = await getSKIPEM('production');
      const parsedPassportData = initPassportDataParsing(scanResult.passportData, skiPem);

      // Check again if scan was cancelled
      if (scanCancelledRef.current) {
        return;
      }

      setStatusMessage('Storing document...');

      // Store the document
      await storePassportData(selfClient, parsedPassportData);

      // Check again if scan was cancelled
      if (scanCancelledRef.current) {
        return;
      }

      setStatusMessage('Success!');

      // Navigate to success screen with the document data
      setTimeout(() => {
        if (!scanCancelledRef.current) {
          onNavigate('success', { document: parsedPassportData });
        }
      }, 500);
    } catch (err) {
      // Check if scan was cancelled
      if (scanCancelledRef.current) {
        return;
      }

      console.error('NFC scan failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to scan NFC chip';
      setError(errorMessage);
      setStatusMessage(null);

      Alert.alert('Scan Failed', errorMessage, [
        {
          text: 'Try Again',
          onPress: () => {
            setError(null);
            handleStartScan();
          },
        },
        { text: 'Cancel', onPress: handleCancel, style: 'cancel' },
      ]);
    } finally {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
        scanTimeoutRef.current = null;
      }
      setIsScanning(false);
    }
  }, [selfClient, mrzData, onNavigate, handleCancel]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      scanCancelledRef.current = true;
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
        scanTimeoutRef.current = null;
      }
    };
  }, []);

  // Auto-start scan when component mounts
  useEffect(() => {
    if (!hasAutoStartedRef.current) {
      hasAutoStartedRef.current = true;
      // Small delay to allow UI to settle
      const timer = setTimeout(() => {
        handleStartScan();
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [handleStartScan]);

  return (
    <ScreenLayout title="NFC Scan" onBack={handleCancel} contentStyle={styles.screenContent}>
      <View style={styles.contentWrapper}>
        <View style={styles.instructionsContainer}>
          <Text style={styles.instructionsTitle}>Scan NFC Chip</Text>
          <Text style={styles.instructionsText}>
            Place your phone against the NFC chip in your document and keep it still until the scan completes.
          </Text>
          <Text style={styles.disclaimer}>
            The chip contains encrypted data that verifies the authenticity of your document.
          </Text>
        </View>

        {isScanning && (
          <View style={styles.scanningContainer}>
            <ActivityIndicator size="large" color="#2563eb" />
            {statusMessage && <Text style={styles.scanningText}>{statusMessage}</Text>}
          </View>
        )}

        {error && !isScanning && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.mrzInfoContainer}>
          <Text style={styles.mrzInfoTitle}>Document Information</Text>
          <Text style={styles.mrzInfoText}>Document Number: {mrzData.documentNumber}</Text>
          <Text style={styles.mrzInfoText}>Date of Birth: {mrzData.dateOfBirth}</Text>
          <Text style={styles.mrzInfoText}>Date of Expiry: {mrzData.dateOfExpiry}</Text>
        </View>

        <View style={styles.actions}>
          {!isScanning && error && (
            <TouchableOpacity accessibilityRole="button" onPress={handleStartScan} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Try Again</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            accessibilityRole="button"
            onPress={handleCancel}
            style={[styles.secondaryButton, isScanning && styles.disabledButton]}
            disabled={isScanning}
          >
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    gap: 16,
  },
  contentWrapper: {
    flex: 1,
    gap: 20,
  },
  instructionsContainer: {
    gap: 8,
  },
  instructionsTitle: {
    color: '#0f172a',
    fontWeight: '600',
    fontSize: 18,
    marginBottom: 4,
  },
  instructionsText: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 20,
  },
  disclaimer: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },
  statusCard: {
    backgroundColor: '#f1f5f9',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  statusTitle: {
    color: '#0f172a',
    fontWeight: '600',
    fontSize: 16,
  },
  statusText: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 20,
  },
  scanningContainer: {
    alignItems: 'center',
    gap: 12,
    padding: 24,
  },
  scanningText: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '500',
  },
  errorContainer: {
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 14,
  },
  mrzInfoContainer: {
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  mrzInfoTitle: {
    color: '#0f172a',
    fontWeight: '600',
    fontSize: 14,
    marginBottom: 4,
  },
  mrzInfoText: {
    color: '#475569',
    fontSize: 13,
  },
  actions: {
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#0f172a',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#e2e8f0',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    backgroundColor: '#cbd5e1',
    opacity: 0.6,
  },
});
