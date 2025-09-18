/*
 * Public API Surface of @selfxyz/qrcode-angular
 */

// Main module
export * from './lib/qrcode-angular.module';

// Components
export * from './lib/components/self-qrcode/self-qrcode.component';
export * from './lib/components/self-qrcode-wrapper/self-qrcode-wrapper.component';
export * from './lib/components/led/led.component';

// Services
export * from './lib/services/websocket.service';

// Utils
export * from './lib/utils/utils';
export * from './lib/utils/styles';
export { initWebSocket } from './lib/utils/websocket';

// Re-export types from common
export type { SelfApp } from '@selfxyz/common';
export { countries } from '@selfxyz/common';
