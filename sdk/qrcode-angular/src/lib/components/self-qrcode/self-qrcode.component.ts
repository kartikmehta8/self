import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  ViewChild,
  ElementRef,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { QRCodeModule } from 'angularx-qrcode';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import lottie, { AnimationItem } from 'lottie-web';

import type { SelfApp } from '@selfxyz/common';
import { getUniversalLink, REDIRECT_URL, WS_DB_RELAYER } from '@selfxyz/common';

import { LedComponent } from '../led/led.component';
import { WebSocketService } from '../../services/websocket.service';
import { QRcodeSteps } from '../../utils/utils';
import { containerStyles, ledContainerStyles, qrContainerStyles } from '../../utils/styles';

// Import animations
const checkAnimation = require('../../animations/check_animation.json');
const xAnimation = require('../../animations/x_animation.json');

export interface SelfQRcodeProps {
  selfApp: SelfApp;
  onSuccess: () => void;
  onError: (data: { error_code?: string; reason?: string }) => void;
  type?: 'websocket' | 'deeplink';
  websocketUrl?: string;
  size?: number;
  darkMode?: boolean;
}

// Re-export WebAppInfo interface for consistency
export interface WebAppInfo {
  appName: string;
  userId: string;
  logoBase64: string;
}

@Component({
  selector: 'lib-self-qrcode',
  standalone: true,
  imports: [CommonModule, QRCodeModule, LedComponent],
  templateUrl: './self-qrcode.component.html',
  styleUrls: ['./self-qrcode.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelfQRcodeComponent implements OnInit, OnDestroy, AfterViewInit {
  @Input() selfApp!: SelfApp;
  @Input() onSuccess!: () => void;
  @Input() onError!: (data: { error_code?: string; reason?: string }) => void;
  @Input() type: 'websocket' | 'deeplink' = 'websocket';
  @Input() websocketUrl: string = WS_DB_RELAYER;
  @Input() size: number = 300;
  @Input() darkMode: boolean = false;

  @ViewChild('animationContainer', { static: false }) animationContainer!: ElementRef;

  public proofStep: number = QRcodeSteps.WAITING_FOR_MOBILE;
  public sessionId: string = '';
  public qrValue: string = '';
  public QRcodeSteps = QRcodeSteps;

  private destroy$ = new Subject<void>();
  private currentAnimation: AnimationItem | null = null;

  constructor(
    private webSocketService: WebSocketService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.sessionId = uuidv4();
    this.updateQRValue();
    this.initializeWebSocket();
  }

  ngAfterViewInit(): void {
    // Subscribe to proof step changes after view init
    this.webSocketService.proofStep$.pipe(takeUntil(this.destroy$)).subscribe((step: number) => {
      this.proofStep = step;
      this.handleProofStepChange(step);
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.webSocketService.cleanup();
    this.destroyAnimation();
  }

  private initializeWebSocket(): void {
    if (!this.sessionId) return;

    console.log('[QRCode] Initializing new WebSocket connection');
    this.webSocketService.initializeConnection(
      this.websocketUrl,
      {
        ...this.selfApp,
        sessionId: this.sessionId,
      },
      this.type,
      () => {
        console.log('[QRCode] Success callback triggered');
        this.onSuccess();
      },
      (data) => {
        console.log('[QRCode] Error callback triggered', data);
        this.onError(data);
      }
    );
  }

  private updateQRValue(): void {
    if (this.type === 'websocket') {
      this.qrValue = `${REDIRECT_URL}?sessionId=${this.sessionId}`;
    } else {
      this.qrValue = getUniversalLink({
        ...this.selfApp,
        sessionId: this.sessionId,
      });
    }
  }

  private handleProofStepChange(step: number): void {
    switch (step) {
      case QRcodeSteps.PROOF_GENERATION_FAILED:
        this.playAnimation(xAnimation, () => {
          this.webSocketService.resetStep();
        });
        break;
      case QRcodeSteps.PROOF_VERIFIED:
        this.playAnimation(checkAnimation, () => {
          this.webSocketService.resetStep();
        });
        break;
      default:
        this.destroyAnimation();
        break;
    }
  }

  private playAnimation(animationData: any, onComplete: () => void): void {
    if (this.animationContainer && this.animationContainer.nativeElement) {
      this.destroyAnimation();

      this.currentAnimation = lottie.loadAnimation({
        container: this.animationContainer.nativeElement,
        renderer: 'svg',
        loop: false,
        autoplay: true,
        animationData: animationData.default || animationData,
      });

      this.currentAnimation.addEventListener('complete', () => {
        onComplete();
      });
    }
  }

  private destroyAnimation(): void {
    if (this.currentAnimation) {
      this.currentAnimation.destroy();
      this.currentAnimation = null;
    }
  }

  public getContainerStyles(): Record<string, string> {
    return containerStyles;
  }

  public getLedContainerStyles(): Record<string, string> {
    return ledContainerStyles;
  }

  public getQrContainerStyles(): Record<string, string> {
    return qrContainerStyles(this.size);
  }

  public showQRCode(): boolean {
    return (
      this.proofStep === QRcodeSteps.WAITING_FOR_MOBILE ||
      this.proofStep === QRcodeSteps.MOBILE_CONNECTED
    );
  }

  public showSpinner(): boolean {
    return (
      this.proofStep === QRcodeSteps.PROOF_GENERATION_STARTED ||
      this.proofStep === QRcodeSteps.PROOF_GENERATED
    );
  }

  public showAnimation(): boolean {
    return (
      this.proofStep === QRcodeSteps.PROOF_GENERATION_FAILED ||
      this.proofStep === QRcodeSteps.PROOF_VERIFIED
    );
  }
}
