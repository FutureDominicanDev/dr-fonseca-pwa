# Apple iOS v20 Readiness

Prepared June 23, 2026.

## Native Build Identity

- App name: Dr. Fonseca Portal
- Bundle ID: com.drfonsecacirujanoplastico.portal
- Marketing version: 1.0.19
- Build number: 20
- Category: Medical
- Privacy policy URL: https://portal.drfonsecacirujanoplastico.com/privacy
- Support URL: https://portal.drfonsecacirujanoplastico.com/support
- Account deletion URL: https://portal.drfonsecacirujanoplastico.com/account-deletion
- Suggested SKU: dr-fonseca-portal-ios

## Local Verification

- `npm run build` passed.
- iOS simulator compile passed for scheme `App` on iPhone 17 / iOS 26.5.
- iOS Release device build passed with `CODE_SIGNING_ALLOWED=NO`.
- Public metadata URLs returned HTTP 200:
  - `/privacy`
  - `/support`
  - `/account-deletion`
  - `/login`
- App Store Connect opened in Safari, but this Mac was not signed in.

## Native iOS Submission Prep Completed

- iOS version/build now align with Android v20: `1.0.19` / `20`.
- Push Notifications capability is declared in the Xcode project.
- `App.entitlements` is wired into Debug and Release.
- `AppDelegate.swift` forwards APNs registration success/failure events to Capacitor Push Notifications.

## Current Blocker

Archive/upload is blocked by Apple signing:

```text
Signing for "App" requires a development team.
```

This Mac currently reports:

```text
0 valid identities found
0 local provisioning profiles
```

## Needed In Apple Developer / App Store Connect

- Sign in to App Store Connect with Account Holder, Admin, or App Manager access.
- Confirm latest Apple agreements are accepted in Business if prompted.
- Create or select the bundle identifier `com.drfonsecacirujanoplastico.portal`.
- Enable Push Notifications for the App ID.
- Select the Apple Developer Team in Xcode for the `App` target.
- Let Xcode create/download signing certificates and provisioning profiles.
- Create the App Store Connect app record before upload if it does not already exist.
- Upload a signed archive to App Store Connect, then process it for TestFlight.

## App Store Connect Metadata Draft

- Name: Dr. Fonseca Portal
- Primary language: Spanish (Latin America) or Spanish (Mexico), depending on account options.
- Bundle ID: com.drfonsecacirujanoplastico.portal
- SKU: dr-fonseca-portal-ios
- User access: Full access unless the account needs app-level access limits.
- Category: Medical
- Age rating: complete honestly from the questionnaire; medical portal content likely needs health/medical disclosures but not emergency/diagnosis claims.
- Promotional text: Portal privado para comunicacion segura entre pacientes autorizados y el equipo medico de Dr. Fonseca.
- Description: Dr. Fonseca Portal ayuda a pacientes autorizados y personal de la clinica a coordinar mensajes, archivos clinicos, instrucciones, recetas, fotos, videos y seguimiento relacionado con la atencion. No sustituye servicios de emergencia, diagnostico medico ni consulta presencial.
- Keywords: Dr Fonseca,portal medico,cirugia plastica,pacientes,clinica
- Support URL: https://portal.drfonsecacirujanoplastico.com/support
- Privacy Policy URL: https://portal.drfonsecacirujanoplastico.com/privacy

## Review Notes Draft

This is a private medical office portal for Dr. Miguel Fonseca / Siluety Plastic Surgery. Accounts must be approved by the clinic before patient rooms or medical files are visible. The app is used by approved clinic staff and patients for secure communication and care coordination. It does not diagnose, treat, prescribe autonomously, replace emergency services, or provide public medical advice.

Provide Apple with a temporary review account that contains synthetic or training-only data before final submission.

## Do Not Submit Yet

- Do not submit to App Review until a signed TestFlight build has been tested on a real iPhone.
- Do not expose real patient data to Apple review accounts.
- Ask for explicit final confirmation immediately before submitting the app for App Review.
