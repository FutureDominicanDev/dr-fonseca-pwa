# Store Submission Packet

Prepared May 11, 2026.

This packet is the starting point for publishing the existing Dr. Fonseca PWA as store apps without changing the production portal workflow.

## App Identity

- App display name: Dr. Fonseca Portal
- Web portal: https://portal.drfonsecacirujanoplastico.com
- Suggested iOS bundle id: com.drfonsecacirujanoplastico.portal
- Suggested Android package id: com.drfonsecacirujanoplastico.portal
- Category: Medical
- Support email: support@elbanova.tech
- Privacy policy: https://portal.drfonsecacirujanoplastico.com/privacy
- Support URL: https://portal.drfonsecacirujanoplastico.com/support
- Account deletion URL: https://portal.drfonsecacirujanoplastico.com/account-deletion

## Recommended Wrapper Path

- Android: Trusted Web Activity first. It keeps the live PWA behavior closest to Chrome, supports Play Store delivery, and uses Digital Asset Links to prove the app owns the portal domain.
- iOS: Capacitor/WKWebView shell. Apple is stricter with apps that look like simple website wrappers, so the iOS shell should include a branded launch screen, camera/microphone/file permission handling, app review notes, and links to privacy, support, account deletion, and training.

## Do Not Submit Until These Are Verified

- Staff pending approval still blocks patient data.
- Regular staff only see assigned patient rooms and assigned media.
- Doctor/owner can see the full portal and cannot be deleted by another admin.
- Account deletion, privacy, support, and training pages open from the app.
- Password reset links open correctly from email and phone recovery flows.
- Camera, microphone, file upload, audio playback, and signed media URLs work inside the wrapper.
- Push notification behavior is tested on real iPhone and Android devices.
- A reviewer/demo path is documented without exposing real patient data.

## Source Files

- Apple review notes: `apple-review-notes.md`
- Google Play Data Safety draft: `google-play-data-safety-draft.md`
- Wrapper plan: `wrapper-plan.md`
- Android Digital Asset Links template: `android-assetlinks.template.json`

