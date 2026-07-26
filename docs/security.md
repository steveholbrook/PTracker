# Security

## Enforcement model

UI permissions improve usability. Firestore and Storage Security Rules provide
the actual security boundary. Hiding a button is never treated as authorisation.

## Project roles

| Capability | Admin | PM | Delivery | Finance | Internal Viewer | Customer Viewer |
|---|---:|---:|---:|---:|---:|---:|
| Create projects | Yes | No | No | No | No | No |
| Manage access | Yes | No | No | No | No | No |
| Edit settings | Yes | Yes | No | No | No | No |
| Edit POAP | Yes | Yes | Yes | No | No | No |
| Load Forecast | Yes | Yes | No | No | No | No |
| Edit Actuals / FI upload | Yes | Yes | No | No | No | No |
| Create invoice | Yes | Yes | No | Yes | No | No |
| Finance approval | Yes | No | No | Yes | No | No |
| Read internal rates | Yes | Yes | Yes | Yes | Yes | No |

## Rule invariants

- Authentication is required.
- Project membership is checked on project reads.
- Customer Viewers cannot read Forecast, Actuals, FI, PO, Invoice or Credit Note
  collections.
- Approved Forecast baselines are immutable.
- Approved POAP baselines cannot be updated and are never deleted.
- Actual entries with invoice locks cannot be edited.
- A new Actual lock must correspond to an invoice with the same code and covered
  week.
- Sent and Paid invoices cannot be changed.
- Credit notes require a reason and cannot be changed or deleted.
- Audit entries are append-only and must identify the authenticated user.
- Storage is project-isolated, size-limited and MIME-type checked.

## First system administrator

Project creation is restricted to a global system administrator. After creating
the first Firebase Authentication user:

1. Copy the user's UID from Authentication > Users.
2. Open Firestore Database > Data.
3. Create collection `users`.
4. Create document with the exact UID.
5. Add:

```text
email: your-email@example.com
displayName: Your Name
systemRole: ADMIN
```

Do not give `systemRole: ADMIN` to routine users. Project administrators are
assigned in `projects/{projectId}/members/{uid}`.

## App Check

`NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY` is optional during initial setup. For
production, register the App Hosting domains with reCAPTCHA Enterprise, set this
environment variable and monitor App Check metrics before enabling enforcement.

## Validation

Run unit tests and Firebase Emulator rule tests before production:

```powershell
npm run test
npm run test:rules
```

The current Firebase CLI requires Java 21 for emulators. The GitHub security
workflow installs Java 21 automatically.

