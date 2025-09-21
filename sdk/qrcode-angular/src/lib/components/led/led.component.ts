import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

import { QRcodeSteps } from '../../utils/utils';
import { ledStyles } from '../../utils/styles';

@Component({
  selector: 'lib-led',
  standalone: true,
  imports: [CommonModule],
  template: ` <div [ngStyle]="getLedStyles()"></div> `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LedComponent {
  @Input() size: number = 8;
  @Input() connectionStatus: number = QRcodeSteps.DISCONNECTED;

  private readonly green = '#31F040';
  private readonly blue = '#424AD8';
  private readonly gray = '#95a5a6';

  private getColor(): string {
    if (this.connectionStatus >= QRcodeSteps.MOBILE_CONNECTED) {
      return this.green;
    } else if (this.connectionStatus >= QRcodeSteps.WAITING_FOR_MOBILE) {
      return this.blue;
    } else {
      return this.gray;
    }
  }

  getLedStyles(): Record<string, string> {
    return ledStyles(this.size, this.getColor());
  }
}
