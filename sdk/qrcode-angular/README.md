# @selfxyz/qrcode-angular

An Angular component library for generating QR codes for Self passport verification.

## Installation

```bash
npm install @selfxyz/qrcode-angular
# or
yarn add @selfxyz/qrcode-angular
```

## Basic Usage

### 1. Import the Module

```typescript
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { SelfQRcodeAngularModule } from '@selfxyz/qrcode-angular';

import { AppComponent } from './app.component';

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule, SelfQRcodeAngularModule],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
```

### 2. Use the Component

```typescript
import { Component } from '@angular/core';
import { SelfApp } from '@selfxyz/qrcode-angular';
import { v4 as uuidv4 } from 'uuid';

@Component({
  selector: 'app-verification',
  template: `
    <div class="verification-container">
      <h1>Verify Your Identity</h1>
      <p>Scan this QR code with the Self app to verify your identity</p>

      <lib-self-qrcode
        [selfApp]="selfApp"
        [onSuccess]="onSuccess"
        [onError]="onError"
        [size]="350"
        [darkMode]="false"
      >
      </lib-self-qrcode>

      <p class="text-sm text-gray-500">User ID: {{ userId.substring(0, 8) }}...</p>
    </div>
  `,
})
export class VerificationComponent {
  userId = uuidv4();

  selfApp: SelfApp = {
    appName: 'My Application',
    scope: 'my-application-scope',
    endpoint: 'https://myapp.com/api/verify',
    userId: this.userId,
    disclosures: {
      // Request passport information
      name: true,
      nationality: true,
      date_of_birth: true,

      // Set verification rules
      minimumAge: 18,
      excludedCountries: ['IRN', 'PRK', 'RUS'],
      ofac: true,
    },
  };

  onSuccess = () => {
    console.log('Verification successful!');
    // Handle successful verification
    // Redirect or update UI
  };

  onError = (data: { error_code?: string; reason?: string }) => {
    console.error('Verification failed:', data);
    // Handle verification error
  };
}
```

## Standalone Component Usage

If you prefer using standalone components:

```typescript
import { Component } from '@angular/core';
import { SelfQRcodeComponent } from '@selfxyz/qrcode-angular';

@Component({
  selector: 'app-verification',
  standalone: true,
  imports: [SelfQRcodeComponent],
  template: `
    <lib-self-qrcode [selfApp]="selfApp" [onSuccess]="onSuccess" [onError]="onError">
    </lib-self-qrcode>
  `,
})
export class VerificationComponent {
  // ... component logic
}
```

## Component Properties

The `lib-self-qrcode` component accepts the following inputs:

| Property       | Type                                                       | Required | Default       | Description                                           |
| -------------- | ---------------------------------------------------------- | -------- | ------------- | ----------------------------------------------------- |
| `selfApp`      | `SelfApp`                                                  | Yes      | -             | The SelfApp configuration object                      |
| `onSuccess`    | `() => void`                                               | Yes      | -             | Callback function executed on successful verification |
| `onError`      | `(data: { error_code?: string; reason?: string }) => void` | Yes      | -             | Callback function executed on verification error      |
| `type`         | `'websocket' \| 'deeplink'`                                | No       | `'websocket'` | Connection type for verification                      |
| `websocketUrl` | `string`                                                   | No       | WS_DB_RELAYER | Custom WebSocket URL for verification                 |
| `size`         | `number`                                                   | No       | 300           | QR code size in pixels                                |
| `darkMode`     | `boolean`                                                  | No       | false         | Enable dark mode styling                              |

## SelfApp Configuration

The `SelfApp` object allows you to configure your application's verification requirements:

| Parameter     | Type   | Required | Description                                    |
| ------------- | ------ | -------- | ---------------------------------------------- |
| `appName`     | string | Yes      | The name of your application                   |
| `scope`       | string | Yes      | A unique identifier for your application       |
| `endpoint`    | string | Yes      | The endpoint that will verify the proof        |
| `logoBase64`  | string | No       | Base64-encoded logo to display in the Self app |
| `userId`      | string | Yes      | Unique identifier for the user                 |
| `disclosures` | object | No       | Disclosure and verification requirements       |

### Disclosure Options

The `disclosures` object can include the following options:

| Option              | Type     | Description                                  |
| ------------------- | -------- | -------------------------------------------- |
| `issuing_state`     | boolean  | Request disclosure of passport issuing state |
| `name`              | boolean  | Request disclosure of the user's name        |
| `nationality`       | boolean  | Request disclosure of nationality            |
| `date_of_birth`     | boolean  | Request disclosure of birth date             |
| `passport_number`   | boolean  | Request disclosure of passport number        |
| `gender`            | boolean  | Request disclosure of gender                 |
| `expiry_date`       | boolean  | Request disclosure of passport expiry date   |
| `minimumAge`        | number   | Verify the user is at least this age         |
| `excludedCountries` | string[] | Array of country codes to exclude            |
| `ofac`              | boolean  | Enable OFAC compliance check                 |

## Services

### WebSocketService

The library includes a `WebSocketService` that manages WebSocket connections:

```typescript
import { WebSocketService } from '@selfxyz/qrcode-angular';

constructor(private webSocketService: WebSocketService) {}

// The service is automatically used by the SelfQRcodeComponent
// You can also inject it directly if needed for custom implementations
```

## Styling

The component uses Angular's `ngStyle` for dynamic styling. You can customize the appearance by:

1. **CSS Custom Properties**: Override the default colors and sizes
2. **Component Styling**: Use Angular's component styling features
3. **Global Styles**: Apply global CSS classes

```css
/* Custom LED colors */
lib-self-qrcode {
  --led-green: #31f040;
  --led-blue: #424ad8;
  --led-gray: #95a5a6;
}
```

## Development

### Building the Library

```bash
npm run build
```

### Running Tests

```bash
npm test
```

### Publishing

```bash
npm run build
npm publish
```

## Integration with Backend

This Angular SDK is designed to work with the `@selfxyz/core` backend SDK. When configuring your QR code, set the verification endpoint to point to your API that uses the backend SDK:

```typescript
const selfApp: SelfApp = {
  appName: 'My Application',
  scope: 'my-application-scope',
  endpoint: 'https://my-api.com/api/verify', // Your API using @selfxyz/core
  userId,
  disclosures: {
    name: true,
    nationality: true,
    date_of_birth: true,
    passport_number: true,
    minimumAge: 20,
    excludedCountries: ['IRN', 'PRK'],
    ofac: true,
  },
};
```

## Verification Flow

1. Your Angular application displays the QR code to the user
2. The user scans the QR code with the Self app
3. The Self app guides the user through the passport verification process
4. The proof is generated and sent to your verification endpoint
5. Upon successful verification, the `onSuccess` callback is triggered

The QR code component displays the current verification status with an LED indicator and changes its appearance based on the verification state.

## Browser Support

This library supports all modern browsers that support:

- ES2022
- WebSocket API
- SVG rendering (for QR codes and animations)

## License

MIT

## Contributing

Please read the contributing guidelines in the main repository.
