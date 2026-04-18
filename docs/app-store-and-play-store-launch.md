# App Store + Play Store Launch Pack

This project can now be published as:
- PWA (web)
- iOS app (App Store)
- Android app (Google Play)

## What Is Already Prepared

- PWA icon set in `public/`:
  - `icon-192.png`
  - `icon-512.png`
  - `apple-touch-icon.png`
- Store asset generator:
  - `scripts/generate-store-assets.sh`
- Generated store assets:
  - `assets/store/ios/icons/`
  - `assets/store/android/icons/`

## Must-Have Features Before Submission

- Native push notifications (APNs + FCM)
- Native camera/microphone/file permissions
- Deep links for patient room open
- In-app call overlay flow
- Privacy policy + terms links in app settings

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
3. Closed beta with clinic staff
4. Production rollout to both stores

## Notes

- Keep all patient communication inside the app flow (no external browser UX).
- Regenerate icons with:

```bash
scripts/generate-store-assets.sh
```
