# Apple App Privacy Draft

Prepared June 23, 2026 for `Dr. Fonseca Portal` / Apple ID `6783560481`.

Use this as the App Store Connect App Privacy working draft. Final responses should be reviewed by the app owner because Apple treats the published labels as legal/compliance representations.

## Global Answers

- The app collects data from users: Yes.
- Data is linked to the user's identity: Yes for the selected data types below.
- Data is used for tracking: No.
- Data is used for third-party advertising or marketing: No.
- Data is sold: No.
- Third-party SDKs observed in code/dependencies: Supabase, Capacitor plugins, Nodemailer, web-push, PDF utilities. No obvious analytics/tracking SDK dependency was found.

## Data Types To Select

### Contact Info

Select:

- Name
- Email Address
- Phone Number

Likely purposes:

- App Functionality
- Account Management
- Customer Support
- Developer's Advertising or Marketing: No
- Third-Party Advertising: No
- Analytics: No
- Product Personalization: No
- Other Purposes: No, unless Apple requires support/security retention to be recorded there.

Notes:

- Profiles, registrations, support requests, staff invites, and review/support workflows may use names, emails, and phone numbers.
- Office location is a clinic/workflow assignment field, not the user's home address.

### Health and Fitness

Select:

- Health

Likely purposes:

- App Functionality
- Customer Support

Notes:

- The privacy policy discloses procedure, surgery date, allergies, medications, prescriptions, clinical files, notes, and related medical/treatment communication.
- The app is a communication and record-organization portal. It does not diagnose, treat, prescribe autonomously, or replace medical care.

### Location

Select:

- Coarse Location

Likely purposes:

- App Functionality
- Fraud Prevention or Security

Notes:

- The native app does not request GPS permission and `next.config.ts` disables browser geolocation.
- Staff signup can capture approximate city/region/country from Vercel IP headers for approval/security context.

### User Content

Select:

- Emails or Text Messages
- Photos or Videos
- Audio Data
- Customer Support
- Other User Content

Likely purposes:

- App Functionality
- Customer Support

Notes:

- Users can exchange portal chat messages, upload photos/videos/audio/documents/PDFs, and submit support/account deletion requests.
- Clinical media may include plastic-surgery treatment context and should be treated as health-related user content.

### Identifiers

Select:

- User ID
- Device ID

Likely purposes:

- App Functionality
- Fraud Prevention or Security

Notes:

- Supabase auth/profile IDs identify users.
- Push notification registrations store web push endpoints and native push tokens tied to staff IDs or patient rooms.

### Usage Data

Select:

- Product Interaction

Likely purposes:

- App Functionality
- Fraud Prevention or Security

Notes:

- Admin audit events, staff access records, patient room activity, and security-related workflow records are used to operate and secure the portal.
- No advertising analytics SDK was found.

## Data Types Not Expected

- Purchases
- Financial Info
- Contacts
- Search History
- Browsing History
- Sensitive Info as a separate category, unless Apple guidance or owner review decides the clinical context must also be represented there beyond Health and User Content.
- Diagnostics, unless production infrastructure or third-party tools collect crash, performance, or diagnostic logs beyond normal hosting/security logs.
- Other Data, unless Apple requires a catch-all for staff access data not covered by Product Interaction, Identifiers, or Contact Info.

## Review Before Publishing

- Confirm whether Vercel/Supabase platform logs should make Diagnostics or Other Data necessary.
- Confirm whether any hidden analytics/monitoring services are enabled outside the repository.
- Confirm whether Apple should be told that Content Rights includes patient/staff uploaded third-party content with necessary clinic/patient permissions.
