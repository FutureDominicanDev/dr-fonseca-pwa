# Apple App Review Notes Draft

## Reviewer Access

This is a private medical office portal for Dr. Miguel Fonseca / Siluety Plastic Surgery. It is not a public social network or public medical advice app. Accounts must be approved by the clinic before patient rooms or medical files are visible.

Provide Apple with one of these review paths before submission:

- A temporary review staff account with no real patient data.
- A temporary review account that can open `/training`, the compact icon legend, without exposing real patient data.
- Clear instructions that new staff registrations intentionally remain blocked until approved.

## Medical Scope

Suggested review wording:

Dr. Fonseca Portal is a secure communication and care-coordination portal for an existing clinic. The app is used by approved clinic staff and patients to exchange messages, files, prescriptions, internal notes, and appointment-related information. It does not diagnose, treat, prescribe autonomously, replace emergency services, or provide public medical advice.

## Account And Data Controls

- Account creation exists, so account deletion must remain reachable inside the app and in App Store metadata.
- Deletion requests go to https://portal.drfonsecacirujanoplastico.com/account-deletion.
- Privacy policy is public at https://portal.drfonsecacirujanoplastico.com/privacy.
- Support is public at https://portal.drfonsecacirujanoplastico.com/support and support@elbanova.tech.
- Medical, legal, audit, security, and regulatory retention may apply to clinic records.

## App Privacy Labels Draft

Disclose data linked to the user where applicable:

- Contact Info: name, email address, phone number.
- Health and Fitness / Health data: medical notes, procedure details, surgery dates, prescriptions, allergies, medications, clinic records.
- User Content: messages, photos, videos, audio, PDFs, uploaded files.
- Identifiers: account/user ids, push notification tokens, authentication identifiers.
- Usage Data and Diagnostics: only if logs/analytics are collected for security, support, or reliability.

Do not mark data as used for third-party tracking. The portal should not sell patient data, use patient data for advertising, or share patient data for unrelated analytics.

## iOS Wrapper Risks

- A thin website-only wrapper can be challenged under Apple's minimum functionality expectations. Use Capacitor/WKWebView with native permission handling, branded launch screen, review notes, and app-level navigation support.
- Web push behavior differs from native push. If store reviewers expect push notifications, validate either installed-PWA web push or native APNs before submission.
- File upload, camera, microphone, and password-reset deep links must be tested in TestFlight on real devices.
