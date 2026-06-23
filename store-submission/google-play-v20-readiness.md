# Google Play v20 Readiness Checklist

Updated June 22, 2026.

## Build Identity

- Android package id: `com.drfonsecacirujanoplastico.portal`
- App name: `Dr. Fonseca Portal`
- Current release candidate: versionCode `20`, versionName `1.0.19`
- Target SDK: API `35`
- Minimum SDK: API `24`
- Production portal URL: `https://portal.drfonsecacirujanoplastico.com`

## Release Assets

- Upload AAB: `store-upload/dr-fonseca-portal-google-play-v20.aab`
- Play Store icon: `assets/store/android/icons/PlayStore-512.png` (`512x512`, RGBA PNG)
- Feature graphic: `assets/store/android/feature-graphic-1024x500.png`
- Launcher icon resources: `android/app/src/main/res/mipmap-*/ic_launcher*.png`
- PWA icons: `public/icon-192.png`, `public/icon-512.png`, `public/apple-touch-icon.png`

## Google Play Store Listing

- Category: Medical
- Privacy policy: `https://portal.drfonsecacirujanoplastico.com/privacy`
- Support URL: `https://portal.drfonsecacirujanoplastico.com/support`
- Account deletion URL: `https://portal.drfonsecacirujanoplastico.com/account-deletion`
- Short description suggestion: `Secure clinic messaging and patient care coordination for Dr. Fonseca.`

## Screenshots

Use only demo/test data. Do not show real patient names, photos, medical records, phone numbers, or email addresses.

Generated demo screenshots are staged in `/Users/rmd/Downloads/dr-fonseca-play-store-assets/`.

Recommended phone set:

1. Login screen.
2. Staff inbox with demo unread activity.
3. Patient chat with demo messages.
4. Patient media/form/files panel with demo content.
5. Notification/readiness or staff settings screen.

Recommended format:

- Portrait phone screenshots, 9:16, at least `1080x1920`.
- JPEG or 24-bit PNG with no alpha.
- No device frames or marketing overlays.

## Play Console App Content

- App access: provide Google reviewers a demo login or written reviewer instructions. Because the app is login-gated, this is required for review.
- Data safety: disclose personal info, health info, messages, photos/videos, audio, files/docs, app activity/audit events, device IDs/push tokens, and security practices.
- Health apps declaration: select the appropriate medical / healthcare services and management categories. This app is for secure clinic communication and care coordination; it is not a medical device, diagnostic tool, emergency response app, or treatment recommendation system.
- Privacy policy: keep public, non-geofenced, non-PDF, and consistent with the Data safety form.
- Account deletion: keep the public deletion page available and reachable from the app/store listing.

## Final Device QA Before Production Rollout

- Fresh install opens on Android.
- Login works for staff and doctor accounts.
- Password reset works by email.
- Patient room deep links open the correct chat.
- Camera, microphone, file upload, audio playback, and patient media downloads work.
- Notifications request permission and deliver expected alert sound on real Android devices.
- Room cancellation requires typed confirmation and preserves patient records.
- No real patient data appears in Play Store screenshots.
