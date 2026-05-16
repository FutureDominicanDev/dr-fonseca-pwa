# Wrapper Plan

## Android Preferred Path: Trusted Web Activity

Use TWA for the first Android store build.

Default values:

- Package id: com.drfonsecacirujanoplastico.portal
- Start URL: https://portal.drfonsecacirujanoplastico.com/login
- Scope/origin: https://portal.drfonsecacirujanoplastico.com
- App name: Dr. Fonseca Portal
- Theme color: #0B63CE
- Icons: use `assets/store/android/icons/` generated from `public/app-icon-master.png`

Required before Play upload:

- Generate Android signing key.
- Build TWA project with Bubblewrap or an equivalent TWA template.
- Add the final SHA-256 certificate fingerprint to the portal's `/.well-known/assetlinks.json`.
- Verify the TWA opens without a browser address bar.
- Test login, icon legend, media upload, audio, camera, microphone, password reset, and patient room links on a real Android phone.

## iOS Preferred Path: Capacitor/WKWebView

Use a small native shell that loads the production portal.

Default values:

- Bundle id: com.drfonsecacirujanoplastico.portal
- App name: Dr. Fonseca Portal
- Initial URL: https://portal.drfonsecacirujanoplastico.com/login
- Theme color: #0B63CE
- Icons: use `assets/store/ios/icons/`

Required before App Store upload:

- Apple Developer team selected.
- Branded launch screen.
- WKWebView allows camera, microphone, file picker, audio playback, and secure links.
- External links for privacy, support, account deletion, and the icon legend stay reachable.
- TestFlight pass on real iPhone.
- App Review notes explain private clinic approval flow and provide synthetic demo access.

## Estimated Timeline

Once Apple Developer and Google Play access, signing, final screenshots, and demo-review access are available:

- Android TWA internal test: about 1 focused day.
- Google Play review: commonly several hours to several days, longer if health/data questions are raised.
- iOS Capacitor wrapper and TestFlight: about 2 to 5 focused days depending on native push and deep-link requirements.
- Apple review: often quick, but medical/private-data apps can receive follow-up questions.

## Native Push Decision

Keep PWA/web push for the first TWA if it passes real-device testing. If iOS or Android reviewers/users need more reliable notifications, add native push later with APNs/FCM in the wrapper. That is a separate implementation and test cycle.
