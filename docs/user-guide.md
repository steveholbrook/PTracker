# User guide

## Start

Sign in and select a project. The selected project remains visible in the header.
Switching projects reloads the selected workspace and retains the user session.

## Dashboard

1. Set Project Start Date to a Monday.
2. Confirm Number of Weeks.
3. Choose POAP Automatic or Manual progress.
4. Choose display precision.
5. Review schedule, resource and commercial exception cards.

Display precision changes presentation only; stored values remain unchanged.

## Forecast

1. Download the template.
2. Complete required columns and `W1` to `Wn`.
3. Select **Load new baseline**.
4. Review row warnings.
5. Confirm the approved baseline and horizon.

Replacing a baseline creates a new version. Approved versions are not edited.

## Actuals and FI upload

Manual entry:

1. Select Weeks or Months.
2. Enter days into available cells.
3. Green cells match Forecast; amber cells contain a variance.
4. A padlock means an Invoice has locked the period.

FI upload:

1. Include Project, Employee/Supplier and Item Date.
2. Supply Days, or Quantity with UOM containing Hours.
3. If any Days values exist for a group, PTracker ignores Quantity.
4. Otherwise, ANZ hours divide by 8 and IND hours divide by 9.
5. Review the reconciliation card for skipped rows and unmatched resources.

## Invoices

1. Select Project Code, period type and available start/end.
2. Review Actual Days, Forecast Days, amount and proposed PO remaining.
3. Save the Invoice.
4. Review the evidence pack and progress through the approval statuses.

Saved Invoice periods lock Actuals. Only an eligible Draft Invoice can be
deleted to release the lock. Sent and Paid Invoices remain locked. Credit Notes
reverse value without deleting Invoice history.

## POAP

- Add Workstreams before Activities.
- Double-click empty canvas space to create an Activity.
- Drag bars horizontally to move dates.
- Drag bars vertically to another Workstream.
- Select a bar to expose left/right resize handles.
- Ctrl-click to multi-select and apply bulk status or colour.
- Use the details panel to change dates, owner, status and priority.
- Add FS, SS, FF or SF dependencies in the details panel.
- Enable auto-reschedule to move FS successors.
- Capture a baseline to display comparison ghost bars.
- Enable Critical Path to highlight zero-float Activities and arrows.
- Use Undo/Redo for committed changes.

Activities that overlap in a Workstream are automatically placed in separate
lanes; the Workstream row expands so no bar is obscured.

## Reports

Customer-safe reports omit rates and costs. Internal users can additionally
export Actuals, monthly reconciliation, Invoice documents, evidence packs and
audit history.

## Administration

Administrators assign Firebase UIDs to project roles, manage holidays and POs,
select invoice number format, configure customer-safe mode, create backups,
restore a matching backup and review audit history.

Reset requires the exact project code and removes operational data while
preserving project settings and memberships.

