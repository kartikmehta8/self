import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QRCodeModule } from 'angularx-qrcode';

import { SelfQRcodeComponent } from './components/self-qrcode/self-qrcode.component';
import { SelfQRcodeWrapperComponent } from './components/self-qrcode-wrapper/self-qrcode-wrapper.component';
import { LedComponent } from './components/led/led.component';
import { WebSocketService } from './services/websocket.service';

@NgModule({
  imports: [
    CommonModule,
    QRCodeModule,
    SelfQRcodeComponent,
    SelfQRcodeWrapperComponent,
    LedComponent,
  ],
  exports: [SelfQRcodeComponent, SelfQRcodeWrapperComponent, LedComponent],
  providers: [WebSocketService],
})
export class SelfQRcodeAngularModule {}
