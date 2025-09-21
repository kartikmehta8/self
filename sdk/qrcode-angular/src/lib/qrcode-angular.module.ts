import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QRCodeComponent } from 'angularx-qrcode';

import { SelfQRcodeComponent } from './components/self-qrcode/self-qrcode.component';
import { LedComponent } from './components/led/led.component';
import { WebSocketService } from './services/websocket.service';

@NgModule({
  imports: [
    CommonModule,
    QRCodeComponent,
    SelfQRcodeComponent,
    LedComponent,
  ],
  exports: [SelfQRcodeComponent, LedComponent],
  providers: [WebSocketService],
})
export class SelfQRcodeAngularModule {}
