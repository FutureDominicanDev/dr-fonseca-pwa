# App Store + Play Store Launch Pack

This project can now be published as:
- PWA (web)
- iOS app (App Store)
- Android app (Google Play)

Policy check updated: May 11, 2026.

Official references checked:
- Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Google Play User Data policy: https://support.google.com/googleplay/android-developer/answer/10144311
- Google Play Data safety form guidance: https://support.google.com/googleplay/android-developer/answer/10787469
- Chrome Trusted Web Activity guidance: https://developer.chrome.com/docs/android/trusted-web-activity/

## What Is Already Prepared

- PWA icon set in `public/`:
  - `icon-192.png`
  - `icon-512.png`
  - `apple-touch-icon.png`
- PWA manifest metadata includes a stable app id, root scope, Spanish-Mexico language hint, and Dr. Fonseca brand browser color.
- Store asset generator:
  - `scripts/generate-store-assets.sh`
- Generated store assets:
  - `assets/store/ios/icons/`
  - `assets/store/android/icons/`
- Store submission packet:
  - `store-submission/README.md`
  - `store-submission/apple-review-notes.md`
  - `store-submission/google-play-data-safety-draft.md`
  - `store-submission/wrapper-plan.md`
  - `store-submission/android-assetlinks.template.json`

## Default Store Identity

- App display name: `Dr. Fonseca Portal`
- Suggested iOS bundle id: `com.drfonsecacirujanoplastico.portal`
- Suggested Android package id: `com.drfonsecacirujanoplastico.portal`
- Category: Medical
- Support email: `support@elbanova.tech`
- Privacy policy URL: `https://portal.drfonsecacirujanoplastico.com/privacy`
- Support URL: `https://portal.drfonsecacirujanoplastico.com/support`
- Account deletion URL: `https://portal.drfonsecacirujanoplastico.com/account-deletion`

## Must-Have Verification Before Submission

- Staff pending approval gate blocks patient data.
- Regular staff only see assigned patient rooms and assigned media.
- Doctor/owner keeps full system access and cannot be deleted by another admin.
- Camera, microphone, file upload, audio playback, and signed media URLs work inside the wrapper.
- Deep links for patient room open and password reset links are tested.
- In-app call overlay flow works on real devices.
- Privacy policy, support, icon legend, and account deletion links open inside the wrapper.
- Account deletion link inside the wrapper and in store metadata:
  - `https://portal.drfonsecacirujanoplastico.com/account-deletion`
- Public support URL/email in store metadata:
  - `https://portal.drfonsecacirujanoplastico.com/support`
  - `support@elbanova.tech`
- Privacy URL in store metadata:
  - `https://portal.drfonsecacirujanoplastico.com/privacy`

## Current Policy Readiness Notes

- Apple: the app needs a real app experience, not a thin marketing web clipping. A Capacitor wrapper is the safer iOS path because it can provide native push, permissions, deep links, review notes, and a controlled WebView shell around the production portal.
- Apple: because this app supports account creation, account deletion must be offered inside the app. Keep the deletion page reachable from the wrapper UI and review notes.
- Apple: medical apps receive extra scrutiny. Store copy should describe this as a secure communication and patient-care coordination portal, not a diagnostic, treatment, dosage, or emergency-response tool.
- Apple: health/medical data must not be used for advertising, marketing, profiling, or unrelated analytics. Keep privacy labels aligned with patient contact details, health information, messages, photos/videos/audio/files, diagnostics/logs if collected, and identifiers/auth data.
- Google Play: because staff can create accounts, the Play Console account deletion URL must point to the public deletion page. The privacy policy must explain retention for medical, legal, audit, security, and regulatory reasons.
- Google Play: Data safety should disclose health info, personal info, photos/videos/audio/files, messages, app activity if logged, device/other IDs if push/auth providers use them, and security practices.
- Android wrapper: use the Capacitor native shell path for this medical communication app so push, local notifications, custom sounds, lifecycle, deep links, and secure device features can be integrated consistently.
- iOS wrapper: use Capacitor/WKWebView, not a bare web clipping. Test camera, microphone, file upload, native push permission, local notification sounds, keyboard/safe-area layout, password reset deep links, and patient room links in TestFlight before submission.
- Native alert implementation note: the repo now includes Capacitor dependencies/config and a native bridge for push token registration, local notifications, biometrics capability detection, secure storage, splash, lifecycle, and deep links. Final store-grade alert delivery still needs Apple APNs and Google FCM credentials plus platform sound files in the generated native projects.
- Public storage risk: the current app uses Supabase public URLs for uploaded media. The portal gates UI access, but public bucket URLs can remain reachable if copied. Before final medical-data launch, consider a signed-URL/private-bucket migration with approved Supabase policy changes.

## Screenshot Checklist

Create fresh screenshots after final UI polish.

### iOS (App Store Connect)
- 6.7" iPhone screenshots (required set)
- 6.5" iPhone screenshots (recommended fallback)
- iPad set (if iPad support is enabled)

Suggested screens:
1. Staff inbox overview
2. Patient chat with media + quick replies
3. Video call request card
4. In-app video call overlay
5. Patient profile / care-team details

### Android (Play Console)
- Phone screenshots (at least 2, up to 8)
- 7-inch + 10-inch tablet (if tablet support enabled)
- Feature graphic: 1024x500

Suggested screens:
1. Login role split (Staff / Patient)
2. Staff inbox + unread badges
3. Patient chat
4. In-app call overlay
5. Media library

## Recommended Submission Order

1. Internal testing build (iOS + Android)
2. Verify:
   - Push notifications
   - Deep link entry
   - Camera/mic access
   - Biometric lock
   - Account deletion and privacy/support links from wrapper settings/help
   - Staff pending approval gate
   - Assigned-room restriction for regular staff
3. Closed beta with clinic staff
4. Production rollout to both stores

## Notes

- Keep all patient communication inside the app flow (no external browser UX).
- Regenerate icons with:

```bash
scripts/generate-store-assets.sh
```
