# Apple iOS v20 Readiness

Prepared June 23, 2026.

## Native Build Identity

- App name: Dr. Fonseca Portal
- Apple ID: 6783560481
- Bundle ID: com.drfonsecacirujanoplastico.portal
- Marketing version: 1.0.19
- Build number: 20
- Category: Medical
- Privacy policy URL: https://portal.drfonsecacirujanoplastico.com/privacy
- Support URL: https://portal.drfonsecacirujanoplastico.com/support
- Account deletion URL: https://portal.drfonsecacirujanoplastico.com/account-deletion
- SKU: dr-fonseca-portal-ios
- Apple team: ElbaNova LLC / 6MLV43APMJ

## Local Verification

- `npm run build` passed.
- iOS simulator compile passed for scheme `App` on iPhone 17 / iOS 26.5.
- iOS Release device build passed with `CODE_SIGNING_ALLOWED=NO`.
- App Store archive/export/upload passed with automatic signing.
- Uploaded IPA SHA256:
  `f74a4bfa685cc4c5226319b0a1c41be710f5549da3a0b45e5d6cf747bfcc448a`
- Uploaded IPA paths:
  - `/Users/rmd/Downloads/dr-fonseca-portal-ios-app-store-v20.ipa`
  - `/Users/rmd/Documents/dr-fonseca-pwa/recovered-repo/store-upload/dr-fonseca-portal-ios-app-store-v20.ipa`
- Export options are stored in:
  - `store-submission/ExportOptions-app-store-connect.plist`
  - `store-submission/ExportOptions-app-store-connect-upload.plist`
- Public metadata URLs returned HTTP 200:
  - `/privacy`
  - `/support`
  - `/account-deletion`
  - `/login`

## Native iOS Submission Prep Completed

- iOS version/build now align with Android v20: `1.0.19` / `20`.
- Push Notifications capability is declared in the Xcode project.
- `App.entitlements` is wired into Debug and Release.
- `AppDelegate.swift` forwards APNs registration success/failure events to Capacitor Push Notifications.
- `ITSAppUsesNonExemptEncryption` is set to `false` in `Info.plist` to match the export-compliance answer and reduce repeat questionnaires on future uploads.

## App Store Connect Completed

- App record created for `Dr. Fonseca Portal`.
- Build `1.0.19 (20)` uploaded and attached to the iOS version.
- App metadata saved:
  - Promotional text
  - Description
  - Keywords
  - Support URL
  - Marketing URL
  - Copyright
  - Manual release after approval
- App Store screenshots uploaded for the 6.5 inch iPhone slot from:
  `assets/store/ios/screenshots/iphone-6.5/`
- Primary category saved as Medical.
- Export compliance answered in App Store Connect as no non-exempt encryption documentation required.
- Age rating questionnaire saved:
  - Medical or Treatment Information: Frequent
  - Health or Wellness Topics: Yes
  - Messaging and Chat: Yes
  - Sexual Content or Nudity: Infrequent, for possible clinical plastic-surgery photos
  - Violence/chance-based/gambling/ads/public UGC: No or None as applicable
  - Calculated rating: 16+ in most regions, A16 Brazil, 15+ Korea, and older-OS global 17+ with regional exceptions.

## App Store Connect Metadata Draft

- Name: Dr. Fonseca Portal
- Primary language: Spanish (Mexico)
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

## Remaining Before App Review

- Content Rights: pending explicit legal confirmation before saving. Conservative answer is likely "Yes, it contains, shows, or accesses third-party content, and I have the necessary rights" because patients/staff can upload content and the clinic is expected to have rights/permission to use it in the portal workflow.
- Regulated Medical Device declaration: likely "No" because the app is a private communication and care-coordination portal, not a diagnosis, treatment, monitoring, dosing, or device-control product.
- App Privacy labels: still need to be completed carefully for contact info, health/medical data, user content, identifiers, and any diagnostics/security logs actually collected by the app.
- App Accessibility: still needs completion.
- Pricing and Availability: still needs review/save.
- Digital Services Act: App Store Connect still shows a Business setup notice.
- App Review contact information and review credentials still need exact safe values.
- Do not expose real patient data to Apple review accounts. Use a synthetic/training-only account.

## Do Not Submit Yet

- Ask for explicit final confirmation immediately before submitting the app for App Review.
