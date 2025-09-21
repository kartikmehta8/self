import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import type { SelfApp } from '@selfxyz/common';

import { initWebSocket } from '../utils/websocket';
import { QRcodeSteps } from '../utils/utils';

@Injectable({
  providedIn: 'root',
})
export class WebSocketService implements OnDestroy {
  private destroy$ = new Subject<void>();
  private proofStepSubject = new BehaviorSubject<number>(QRcodeSteps.WAITING_FOR_MOBILE);
  private cleanupFunction: (() => void) | null = null;

  public proofStep$ = this.proofStepSubject.asObservable();

  initializeConnection(
    websocketUrl: string,
    selfApp: SelfApp,
    type: 'websocket' | 'deeplink',
    onSuccess: () => void,
    onError: (data: { error_code?: string; reason?: string }) => void
  ): void {
    // Clean up any existing connection
    this.cleanup();

    console.log('[WebSocketService] Initializing new WebSocket connection');

    this.cleanupFunction = initWebSocket(
      websocketUrl,
      selfApp,
      type,
      (step: number) => {
        this.proofStepSubject.next(step);
      },
      onSuccess,
      onError
    );
  }

  cleanup(): void {
    if (this.cleanupFunction) {
      console.log('[WebSocketService] Cleaning up WebSocket connection');
      this.cleanupFunction();
      this.cleanupFunction = null;
    }
  }

  resetStep(): void {
    this.proofStepSubject.next(QRcodeSteps.WAITING_FOR_MOBILE);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.cleanup();
  }
}
