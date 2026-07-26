# Beginner deployment guide — PTracker

This guide assumes Windows, GitHub repository
`https://github.com/steveholbrook/PTracker`, and no prior Firebase deployment.

## Outcome

You will create:

- a development Firebase project connected to branch `develop`
- a production Firebase project connected to branch `main`
- Firebase Authentication, Firestore, Storage and App Hosting
- automatic production rollout when approved code reaches `main`

Firebase App Hosting is the deployment service. It builds the Next.js
application from GitHub and serves it through managed Cloud Run and Cloud CDN.

## 1. Install the Windows tools

Install:

1. Git: `https://git-scm.com/download/win`
2. Node.js 22 LTS: `https://nodejs.org`
3. Visual Studio Code: `https://code.visualstudio.com`
4. Java 21 only if you want to run Firebase emulator rule tests locally

Restart PowerShell after installation, then confirm:

```powershell
git --version
node --version
npm --version
java -version
```

`java -version` should show 21 or later before running `npm run test:rules`.

## 2. Download PTracker

Open PowerShell:

```powershell
mkdir C:\Projects
cd C:\Projects
git clone https://github.com/steveholbrook/PTracker.git
cd PTracker
npm install
```

## 3. Test the app before Firebase

```powershell
npm run dev
```

Open `http://localhost:3000`, select **Sign in**, then **Explore as
Administrator**. Test Dashboard, POAP, Forecast, Actuals and Invoices.

Stop the app with `Ctrl+C`.

## 4. Create two Firebase projects

Open `https://console.firebase.google.com`.

Create two projects with unique IDs, for example:

```text
ptracker-steve-dev
ptracker-steve-prod
```

Firebase project IDs are globally unique, so your IDs may need extra characters.

For each project:

1. Open Project Settings.
2. Select Usage and billing.
3. Upgrade to Blaze/pay-as-you-go because Firebase App Hosting requires it.
4. Set a small budget alert in Google Cloud Billing.

Do not use the production project for testing.

## 5. Enable Authentication

In each Firebase project:

1. Open Build > Authentication.
2. Select **Get started**.
3. Open Sign-in method.
4. Enable Email/Password.
5. Enable Google if required.
6. Enable Microsoft only after adding the organisation's Microsoft OAuth
   client configuration.

Do not enable Anonymous authentication for production.

## 6. Create Firestore and Storage

In each project:

1. Open Build > Firestore Database.
2. Select **Create database**.
3. Select Production mode.
4. For a Sydney-based application, select `australia-southeast1` (Sydney).
5. Open Build > Storage and create the default bucket.

Firestore location cannot be casually changed later. Make this choice
deliberately.

## 7. Register the Firebase web app

For each Firebase project:

1. Open Project Settings > General.
2. Under Your apps, select the Web `</>` icon.
3. Name it `PTracker Dev Web` or `PTracker Prod Web`.
4. Do not select legacy Hosting setup.
5. Copy the six Firebase configuration values.

The browser Firebase configuration is not a secret. Authentication, Security
Rules and App Check provide security.

## 8. Configure local development

In the local PTracker folder:

```powershell
copy .env.example .env.local
code .env.local
```

Paste the **development** web-app values:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY=
```

Save the file. `.env.local` is ignored by Git and must never be committed.

## 9. Install and sign in to Firebase CLI

```powershell
npm install -g firebase-tools
firebase login
firebase --version
```

From the PTracker folder:

```powershell
copy .firebaserc.example .firebaserc
code .firebaserc
```

Replace the two example project IDs with your real development and production
IDs.

## 10. Deploy rules and indexes

Test first:

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:rules
```

Deploy development rules:

```powershell
firebase use dev
firebase deploy --only firestore:rules,firestore:indexes,storage
```

After testing development, deploy production rules:

```powershell
firebase use prod
firebase deploy --only firestore:rules,firestore:indexes,storage
```

Never replace the repository rules with `allow read, write: if true`.

## 11. Create the first production administrator

In the production Firebase console:

1. Authentication > Users > Add user.
2. Enter your email and a strong temporary password.
3. Copy the generated User UID.
4. Open Firestore Database > Data.
5. Create collection `users`.
6. Create a document whose ID is the exact User UID.
7. Add:

```text
email        your-email@example.com
displayName  Your name
systemRole   ADMIN
```

Repeat in development using the development user's UID.

This global role permits initial project creation. Other users should normally
receive project roles, not global Administrator.

## 12. Connect the production App Hosting backend

In the production Firebase console:

1. Open Hosting & Serverless > App Hosting.
2. Select **Get started** or **Create backend**.
3. Select a region from the current list closest to Sydney.
4. Connect GitHub.
5. Grant the Firebase App Hosting GitHub application access to
   `steveholbrook/PTracker`.
6. Repository: `steveholbrook/PTracker`.
7. App root directory: `/`.
8. Live branch: `main`.
9. Keep automatic rollouts enabled.
10. Backend name: `ptracker-prod`.
11. Select the recommended Node.js runtime.
12. Create the backend.

Firebase supplies a URL similar to:

```text
ptracker-prod--YOUR-PROJECT-ID.REGION.hosted.app
```

## 13. Add production environment variables

Open:

```text
App Hosting > ptracker-prod > Settings > Environment
```

Add all six `NEXT_PUBLIC_FIREBASE_*` production values from Step 7. Environment
values entered in the App Hosting console are available during both build and
runtime.

Trigger a new rollout after saving variables:

1. Open the Rollouts tab.
2. Select Create rollout.
3. Select the latest `main` commit.

## 14. Create the development backend

Create a `develop` branch if it does not exist:

```powershell
git checkout -b develop
git push -u origin develop
git checkout main
```

In the development Firebase project, repeat Steps 12–13 using:

```text
Backend name: ptracker-dev
Live branch: develop
Environment values: development Firebase web config
```

The development hosted URL is your shared test/preview environment. Pull
requests run GitHub checks; merge approved changes to `develop` for business
testing, then merge the tested release to `main`.

## 15. Add App Hosting domains to Authentication

In each Firebase project:

1. Authentication > Settings > Authorised domains.
2. Add that project's `.hosted.app` domain if it is not already present.
3. Add any later custom domain.

Google or Microsoft sign-in can fail if the deployed domain is not authorised.

## 16. Optional but recommended App Check

After the basic deployment works:

1. Open Build > App Check.
2. Register the PTracker web app with reCAPTCHA Enterprise.
3. Add the App Hosting and custom domains.
4. Copy the site key.
5. Add it as `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY` in App Hosting
   Environment settings.
6. Deploy again.
7. Monitor App Check metrics before turning on enforcement.

## 17. First production test

Sign in as the first Administrator and:

1. Create a project.
2. Add a second internal user and Customer Viewer.
3. Load a Forecast template.
4. Add POAP Workstreams and Activities.
5. Import a small FI file.
6. Create a Draft Invoice.
7. Confirm its Actual periods lock.
8. Sign in as Customer Viewer.
9. Confirm Forecast, Actuals, Invoices and Admin are inaccessible.
10. Generate the customer-safe Dashboard PDF.
11. Review Firestore audit entries.

Do not give real users access until this test passes.

## 18. Normal change and release process

```powershell
git checkout develop
git pull
git checkout -b feature/short-description
```

Make and test the change:

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
```

Then:

```powershell
git add .
git commit -m "Describe the change"
git push -u origin feature/short-description
```

Open a GitHub Pull Request into `develop`. When tests and business review pass,
merge it. The development App Hosting backend deploys automatically.

For release, open a Pull Request from `develop` to `main`. Merge only after the
development URL is approved. The production backend then deploys automatically.

## 19. Troubleshooting

### Repository does not appear in App Hosting

GitHub > Settings > Applications > Firebase App Hosting > Configure, then grant
access to `PTracker`. Return to Firebase and refresh the repository list.

### Firebase permission denied

Confirm:

- the signed-in user's UID matches the member document ID
- the member document is under the selected project
- the role name exactly matches one of the six supported values
- the repository Security Rules have been deployed to the selected project

### App shows Demo workspace

The Firebase environment variables were not available at build time. Add them
under App Hosting > Backend > Settings > Environment and create a new rollout.

### Emulator demands Java 21

Install a Java 21 JDK, restart PowerShell and confirm `java -version` shows 21
or later.

### Build fails after a package change

Locally run:

```powershell
npm install
npm run verify
```

Commit both `package.json` and `package-lock.json`.
