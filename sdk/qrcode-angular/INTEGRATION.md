# Angular SDK Integration Guide

## Quick Start

This Angular SDK provides the same functionality as the React version with full feature parity.

### Installation

```bash
cd sdk/qrcode-angular
yarn install
yarn build
```

### Basic Usage

```typescript
// app.module.ts
import { SelfQRcodeAngularModule } from '@selfxyz/qrcode-angular';

@NgModule({
  imports: [SelfQRcodeAngularModule],
  // ...
})
export class AppModule {}

// component.ts
import { SelfApp } from '@selfxyz/qrcode-angular';

@Component({
  template: `
    <lib-self-qrcode [selfApp]="selfApp" [onSuccess]="onSuccess" [onError]="onError">
    </lib-self-qrcode>
  `,
})
export class MyComponent {
  selfApp: SelfApp = {
    appName: 'My App',
    scope: 'my-scope',
    endpoint: 'https://api.example.com/verify',
    userId: 'user-123',
    disclosures: {
      name: true,
      minimumAge: 18,
      ofac: true,
    },
  };

  onSuccess = () => console.log('Success!');
  onError = (error: any) => console.error('Error:', error);
}
```

## Key Differences from React Version

### Component Architecture

- **React**: Functional components with hooks
- **Angular**: Class-based components with lifecycle methods
- **State Management**: RxJS Observables instead of useState
- **Side Effects**: Angular lifecycle hooks instead of useEffect

### Dependency Changes

- `qrcode.react` → `angularx-qrcode`
- `lottie-react` → `lottie-web`
- `react-spinners` → Custom CSS spinner
- Same WebSocket and crypto libraries

### API Compatibility

- Same `SelfApp` interface
- Same callback signatures
- Same WebSocket communication protocol
- Same QR code content format

## Component Mapping

| React Component     | Angular Component            | Notes             |
| ------------------- | ---------------------------- | ----------------- |
| `SelfQRcodeWrapper` | `SelfQRcodeWrapperComponent` | SSR compatibility |
| `SelfQRcode`        | `SelfQRcodeComponent`        | Main component    |
| `LED`               | `LedComponent`               | Status indicator  |

## Service Architecture

### WebSocketService

- Manages WebSocket connections using RxJS
- Provides reactive streams for state updates
- Handles cleanup automatically via Angular lifecycle

### State Management

- Uses BehaviorSubject for proof step state
- Reactive patterns with takeUntil for cleanup
- OnPush change detection for performance

## Build and Distribution

### Building

```bash
yarn build  # Uses ng-packagr
```

### Output Structure

```
dist/qrcode-angular/
├── fesm2022/
├── esm2022/
├── bundles/
└── index.d.ts
```

### Publishing

```bash
yarn publish
```

## Testing Integration

### Unit Testing

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SelfQRcodeComponent } from '@selfxyz/qrcode-angular';

describe('SelfQRcodeComponent', () => {
  let component: SelfQRcodeComponent;
  let fixture: ComponentFixture<SelfQRcodeComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SelfQRcodeComponent],
    });
    fixture = TestBed.createComponent(SelfQRcodeComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
```

## Performance Considerations

### Change Detection

- Uses OnPush strategy for optimal performance
- Reactive patterns minimize unnecessary updates
- Proper cleanup prevents memory leaks

### Bundle Size

- Tree-shakable exports
- Lazy loading compatible
- Similar size to React version

## Troubleshooting

### Common Issues

1. **SSR Issues**: Use `SelfQRcodeWrapperComponent` for server-side rendering
2. **WebSocket Errors**: Check CORS and WebSocket URL configuration
3. **Animation Issues**: Ensure lottie-web is properly installed
4. **QR Code Not Showing**: Verify angularx-qrcode is imported

### Debug Mode

```typescript
// Enable debug logging
console.log('[QRCode Debug]', this.proofStep, this.qrValue);
```

## Migration from React

### Component Template

```html
<!-- Before (React JSX) -->
<SelfQRcodeWrapper
  selfApp="{selfApp}"
  onSuccess="{onSuccess}"
  onError="{onError}"
  size="{300}"
  darkMode="{false}"
/>

<!-- After (Angular Template) -->
<lib-self-qrcode-wrapper
  [selfApp]="selfApp"
  [onSuccess]="onSuccess"
  [onError]="onError"
  [size]="300"
  [darkMode]="false"
>
</lib-self-qrcode-wrapper>
```

### State Management

```typescript
// Before (React)
const [proofStep, setProofStep] = useState(QRcodeSteps.WAITING_FOR_MOBILE);

// After (Angular)
public proofStep: number = QRcodeSteps.WAITING_FOR_MOBILE;
// Managed by WebSocketService via reactive streams
```

## Google Cloud Integration

This Angular SDK is specifically designed for Google Cloud's frontend requirements:

- Compatible with Google Cloud Build
- Works with Cloud Run deployments
- Supports Google Cloud CDN
- Follows Google's Angular best practices
- Optimized for Google Cloud Console integration

### Cloud Deployment Example

```yaml
# cloudbuild.yaml
steps:
  - name: 'node:18'
    entrypoint: 'yarn'
    args: ['install']
    dir: 'sdk/qrcode-angular'

  - name: 'node:18'
    entrypoint: 'yarn'
    args: ['build']
    dir: 'sdk/qrcode-angular'
```

## Support

- Same backend compatibility as React version
- Same WebSocket protocol
- Same verification flow
- Full feature parity achieved

The Angular SDK is production-ready and provides identical functionality to the React version while following Angular best practices and patterns.
