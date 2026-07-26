# Firestore data model

All operational data is nested beneath a project. This makes project isolation
clear in both the repository and Security Rules.

```text
users/{userId}
projectRegistry/{projectId}

projects/{projectId}
projects/{projectId}/members/{userId}
projects/{projectId}/settings/main

projects/{projectId}/poapWorkstreams/{workstreamId}
projects/{projectId}/poapActivities/{activityId}
projects/{projectId}/poapDependencies/{dependencyId}
projects/{projectId}/poapBaselines/{baselineId}
projects/{projectId}/poapHistory/{historyId}

projects/{projectId}/forecastBaselines/{baselineId}
projects/{projectId}/forecastLines/{lineId}

projects/{projectId}/actualResources/{resourceId}
projects/{projectId}/actualEntries/{entryId}
projects/{projectId}/fiUploads/{uploadId}

projects/{projectId}/purchaseOrders/{code}
projects/{projectId}/invoices/{invoiceId}
projects/{projectId}/creditNotes/{creditNoteId}

projects/{projectId}/auditLog/{auditId}
projects/{projectId}/reportHistory/{reportId}
```

## Baseline handling

`settings/main.activeForecastBaselineId` identifies the active Forecast
baseline. Forecast lines carry `baselineId`. Older approved baseline and line
documents remain in Firestore for traceability while the workspace loads only
the active lines.

POAP baselines hold frozen start/end snapshots. One baseline is active for
comparison and renders as ghost bars.

## Invoice evidence

An invoice stores a frozen evidence pack containing:

- active Forecast baseline ID
- resource names, days, day rates and calculated amounts
- total Forecast and Actual days
- invoice amount
- capture timestamp

Later changes to Actuals do not mutate saved evidence.

## Storage paths

```text
projects/{projectId}/forecast/{timestamp-file}
projects/{projectId}/actuals/{timestamp-file}
projects/{projectId}/reports/customer/{file}
projects/{projectId}/reports/internal/{file}
projects/{projectId}/backups/{file}
```

Forecast, Actuals and internal report files are denied to Customer Viewers.

