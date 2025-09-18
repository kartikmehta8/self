import {
  Component,
  Input,
  OnInit,
  ChangeDetectionStrategy,
  Inject,
  PLATFORM_ID
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';

import type { SelfApp } from '@selfxyz/common';
import { SelfQRcodeComponent } from '../self-qrcode/self-qrcode.component';

@Component({
  selector: 'lib-self-qrcode-wrapper',
  standalone: true,
  imports: [CommonModule, SelfQRcodeComponent],
  template: `
    <lib-self-qrcode
      *ngIf="isClient"
      [selfApp]="selfApp"
      [onSuccess]="onSuccess"
      [onError]="onError"
      [type]="type"
      [websocketUrl]="websocketUrl"
      [size]="size"
      [darkMode]="darkMode">
    </lib-self-qrcode>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SelfQRcodeWrapperComponent implements OnInit {
  @Input() selfApp!: SelfApp;
  @Input() onSuccess!: () => void;
  @Input() onError!: (data: { error_code?: string; reason?: string }) => void;
  @Input() type: 'websocket' | 'deeplink' = 'websocket';
  @Input() websocketUrl?: string;
  @Input() size?: number;
  @Input() darkMode?: boolean;

  isClient = false;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  ngOnInit(): void {
    // Only render on client-side to prevent SSR issues
    this.isClient = isPlatformBrowser(this.platformId);
  }
}