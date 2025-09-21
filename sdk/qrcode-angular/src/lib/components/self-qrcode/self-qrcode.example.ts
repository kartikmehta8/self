import { Component } from '@angular/core';
import { SelfQRcodeComponent } from './self-qrcode.component';
import type { SelfApp } from '../../common';

/**
 * Example usage of the SelfQRcodeComponent
 *
 * This example shows how to use the SelfQRcodeComponent in your Angular application
 * for identity verification with QR code scanning.
 */

@Component({
  selector: 'app-example',
  standalone: true,
  imports: [SelfQRcodeComponent],
  template: `
    <div class="example-container">
      <h2>Self Identity Verification</h2>
      <lib-self-qrcode
        [selfApp]="selfApp"
        [type]="'websocket'"
        [size]="300"
        [darkMode]="false"
        (success)="onVerificationSuccess()"
        (error)="onVerificationError($event)">
      </lib-self-qrcode>
    </div>
  `,
  styles: [`
    .example-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2rem;
      padding: 2rem;
    }
  `]
})
export class SelfQRcodeExampleComponent {
  // Example SelfApp configuration
  selfApp: SelfApp = {
    appName: 'My Identity App',
    logoBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    endpointType: 'https',
    endpoint: 'https://myapp.example.com',
    deeplinkCallback: 'myapp://verification',
    header: 'Verify your identity',
    scope: 'identity_verification',
    sessionId: '', // Will be generated automatically
    userId: 'user-123',
    userIdType: 'uuid',
    devMode: false,
    disclosures: {
      name: true,
      date_of_birth: true,
      nationality: true,
      minimumAge: 18
    },
    version: 2,
    chainID: 42220,
    userDefinedData: ''
  };

  onVerificationSuccess(): void {
    console.log('Identity verification successful!');
    // Handle successful verification
    // e.g., redirect to success page, update user state, etc.
  }

  onVerificationError(error: { error_code?: string; reason?: string }): void {
    console.error('Identity verification failed:', error);
    // Handle verification error
    // e.g., show error message, retry option, etc.
  }
}

/**
 * Usage Instructions:
 *
 * 1. Import the component in your module or use it as a standalone component
 * 2. Configure the selfApp object with your application details
 * 3. Bind to the success and error output events
 * 4. Optionally customize the appearance with size, darkMode, etc.
 *
 * Required Properties:
 * - selfApp: SelfApp configuration object
 *
 * Optional Properties:
 * - type: 'websocket' | 'deeplink' (default: 'websocket')
 * - websocketUrl: Custom WebSocket URL (default: WS_DB_RELAYER)
 * - size: QR code size in pixels (default: 300)
 * - darkMode: Dark mode styling (default: false)
 *
 * Output Events:
 * - success: Emitted when verification succeeds
 * - error: Emitted when verification fails (includes error details)
 *
 * The component will automatically:
 * - Generate a unique session ID
 * - Establish WebSocket connection
 * - Display QR code for mobile scanning
 * - Show loading states during proof generation
 * - Display success/error animations
 * - Handle cleanup on component destruction
 */
