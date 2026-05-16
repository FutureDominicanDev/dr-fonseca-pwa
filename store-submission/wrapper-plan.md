# Wrapper Plan

## Android Preferred Path: Capacitor Native Shell

Use Capacitor for the first Android store build so medical alerts can use native plugins instead of relying only on browser/PWA behavior.

Default values:

- Package id: com.drfonsecacirujanoplastico.portal
- Start URL: https://portal.drfonsecacirujanoplastico.com/login
- Scope/origin: https://portal.drfonsecacirujanoplastico.com
- App name: Dr. Fonseca Portal
- Theme color: #0B63CE
- Icons: use `assets/store/android/icons/` generated from `public/app-icon-master.png`

Native plugin baseline now included in the repo:

- Push Notifications
- Local Notifications with a critical-alert channel placeholder
- Biometrics capability detection
- Secure Storage marker
- App lifecycle and deep links
- Splash screen
- Keyboard/native viewport handling

Required before Play upload:

- Generate Android signing key.
- Run `npm run native:add:android` once, then `npm run native:sync`.
- Add Android notification sound assets for the named alert sounds.
- Connect FCM credentials/server delivery for native token sends.
- Verify the native shell opens without browser address bars.
- Test login, icon legend, media upload, audio, camera, microphone, password reset, and patient room links on a real Android phone.

## iOS Preferred Path: Capacitor/WKWebView

Use the same Capacitor native shell that loads the production portal.

Default values:

- Bundle id: com.drfonsecacirujanoplastico.portal
- App name: Dr. Fonseca Portal
- Initial URL: https://portal.drfonsecacirujanoplastico.com/login
- Theme color: #0B63CE
- Icons: use `assets/store/ios/icons/`

Required before App Store upload:

- Apple Developer team selected.
- Branded launch screen.
- Native notification sound files added to the iOS project bundle.
- APNs credentials/server delivery connected for native token sends.
- WKWebView allows camera, microphone, file picker, audio playback, and secure links.
- External links for privacy, support, account deletion, and the icon legend stay reachable.
- TestFlight pass on real iPhone.
- App Review notes explain private clinic approval flow and provide synthetic demo access.

## Estimated Timeline

Once Apple Developer and Google Play access, signing, final screenshots, and demo-review access are available:

- Android Capacitor internal test: about 1 to 3 focused days after signing and FCM credentials.
- Google Play review: commonly several hours to several days, longer if health/data questions are raised.
- iOS Capacitor wrapper and TestFlight: about 2 to 5 focused days depending on native push and deep-link requirements.
- Apple review: often quick, but medical/private-data apps can receive follow-up questions.

## Native Push Decision

Native push is now the selected path for store apps. The web app registers native push tokens when running inside Capacitor; final medical-grade delivery still requires APNs/FCM credentials, native sound files in each platform project, and real-device testing.
