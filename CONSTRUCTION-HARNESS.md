# Liquid Build Design Studio: construction drafting harness

Proposed architecture, September 26, 2026. This document specifies work to build; it does not establish that drafting, generation, or professional review is operational.

## Product

Give homeowners and designers a persistent workspace to describe a project, establish existing conditions, draw and revise layouts, compare options, and assemble a draft package for scoped professional review.

First supported use case: a single-level room remodel or garage-conversion concept. Whole buildings, automated structural design, and full construction-document generation require later, separately validated capabilities.

The first useful output is an editable, dimensioned floor plan with a project brief, assumptions, and unresolved questions. Concept images are optional derivatives of that plan.

## Current repository

- `build.py` generates the public website; `public/` contains browser assets.
- `lib/assistant.js` supplies stateless conversational design intake and quote requests.
- `lib/knowledge.js` supplies category-based planning and ballpark calculations.
- `lib/db.js` stores CRM users, leads, activities, and bids in Postgres.
- `lib/uploads.js` and upload/file endpoints handle lead attachments in Blob storage.
- Public MCP exposes company/planning/lead tools, not authenticated project drafting.

These are useful foundations, but uploads do not constitute plan parsing, CRM membership does not constitute customer project access, and conversational suggestions do not constitute editable drawings.

Keep this product in Liquid Build. Reuse lessons and validation patterns from Liquid Permit; coupling the two applications is not required to deliver the initial studio.

## User workflow

1. Start a project from a room sketch, PDF, photo, or blank canvas. Save requires a customer identity. Identify who owns and may access the project.
2. Establish existing conditions. Enter units and dimensions, or calibrate a drawing with a known dimension. Photos alone cannot establish reliable scale. Extracted geometry remains provisional until confirmed.
3. Draw walls; place doors, windows, fixtures, and furniture. Show dimensions, snap points, and measurement provenance. Distinguish existing, proposed, and demolition elements.
4. Ask for a change, such as “Create a bedroom option while keeping this door and window.” The assistant proposes a structured edit and explains affected elements and unresolved constraints.
5. Preview the difference, accept or reject it, and undo accepted changes. Save alternative layouts as separate revisions/options.
6. Compare options with areas, declared assumptions, open questions, and preliminary quantities. Any budget carries dated rate provenance and exclusions.
7. Invite a collaborator with explicit view/comment/edit rights. Comments attach to an element and revision.
8. Export a draft plan and brief, or request a scoped review. Reviewed packages identify exact files, revision, reviewer, and review scope. Filing and government approval remain separate records.

## Workspace interface

- Left: project brief, source documents, layers, and alternative layouts.
- Center: editable 2D plan with pan/zoom, dimension tools, snapping, selection, and undo/redo.
- Right: selected-element properties and an assistant that previews proposed edits.
- Review panel: missing measurements, conflicting inputs, review findings, and next actions.

Prioritize desktop/tablet drafting and mobile capture/commenting. Start with an SVG-based 2D editor over a structured geometry model; add a derived 3D view after geometry and persistence are dependable. A rendering must not silently alter the saved plan.

## Source of truth

Use a versioned plan document, independent of the UI or model provider. Suggested entities:

- Project and memberships: owner, scope, location, access roles, and linked CRM lead.
- Source version: immutable content hash, private storage reference, page, uploaded date, and author.
- Plan revision: parent revision, schema version, units, coordinate origin, geometry, and creation record.
- Elements: stable IDs for walls, rooms, openings, fixtures, annotations, and dimensions. Openings reference their host wall and position along it.
- Evidence: source version and page/region, value/unit, and classification such as user-stated, assumed, measured, or professionally verified.
- Constraints: fixed elements, confirmed boundaries, supported geometric relationships, and unresolved design decisions.
- Findings: affected elements/revisions, basis, severity, owner, disposition, and next action.
- Review/export: exact revision and output hashes, reviewer identity/scope, findings, and output status.

Choose one canonical coordinate unit and explicit conversion functions. Preserve original input units and precision. Do not derive quantities from decorative images.

## Agent execution contract

The assistant receives the selected project revision and relevant evidence. It can propose typed operations such as `add_wall`, `move_opening`, `set_dimension`, and `create_option`. These are application commands, not arbitrary executable code or SQL.

Every proposal includes expected base revision, targeted element IDs, requested edits, supporting evidence, assumptions, and affected constraints. The server checks membership, schema, current revision, references, geometry, and locked constraints. Unsupported changes become questions or review findings.

Accepted operations apply atomically, create a new revision, and append an audit event. Stale proposals require regeneration or explicit conflict resolution. Repeated requests use idempotency keys. An AI tool result cannot grant authority to edit, publish, contact a contractor, or release a package.

Separate tool sets for intake/extraction, layout proposals, quantities, sourced research, and review coordination. These can initially be modes of one assistant; multiple autonomous agents are not necessary. Keep calculations, persistence, permissions, and release decisions in ordinary application code.

## Geometry and evidence checks

- Finite coordinates, valid dimensions, supported units, and unique element IDs.
- Referenced wall exists; opening fits within its host; invalid or overlapping openings are flagged.
- Room polygons are closed and non-self-intersecting before area is reported.
- Fixed elements and confirmed boundaries cannot change through an unapproved proposal.
- Unknown scale or assumed dimensions remain visible in drawings, quantities, and exports.
- A changed source or dimension invalidates dependent quantities and scoped reviews.
- Uploaded and retrieved document instructions remain untrusted content.

These checks establish internal consistency. They do not by themselves establish buildability or code compliance. Project-specific technical findings require verified applicable sources and appropriate review.

## Services and persistence

Extend the existing Postgres application with versioned migrations for studio records. Add explicit customer authentication and per-project authorization without granting customers CRM team access. Project files must use private storage regardless of the existing marketing-upload configuration.

Keep interactive edits quick and transactional. Use durable jobs for document processing, model calls, renders, and exports, with status, bounded retries, time/cost limits, and cancellation. Store provider/model/prompt versions and actual usage for reproducibility.

Suggested modules: `lib/studio/schema.js`, `geometry.js`, `commands.js`, `permissions.js`, `revisions.js`, and `jobs.js`; authenticated studio endpoints; and a browser studio bundle separate from generated marketing pages. Names are proposals, not existing files.

Keep private drafting tools separate from public MCP discovery. Add authenticated remote drafting only after the same project permissions, revision checks, and action controls work in the website.

## Outputs

MVP: editable project JSON and dimensioned SVG; a draft PDF report after export rendering is implemented and verified. Exports identify revision, units, assumptions, and draft status. Print scale must be explicit and verified for any output claiming a drawing scale.

Later: elevations and schedules derived from supported model elements, then interchange formats demanded by pilot designers. Accepting a DWG upload does not mean the app can edit or faithfully export DWG. Preserve originals and clearly identify unsupported imports.

## Build order and acceptance

1. **Manual drafting foundation:** project access, blank-room editor, dimensions, openings, save/reload, revisions, undo, and SVG export. Acceptance: a user can draw a measured room, reopen it, and obtain identical geometry and area; another project owner cannot access it.
2. **AI edits:** typed proposals, change preview, constraint checks, atomic acceptance, and retry protection. Acceptance: a supported layout change works; a stale revision, missing wall, duplicated command, or unauthorized edit cannot corrupt the plan.
3. **Document assistance:** private PDF/image ingestion, known-dimension calibration, provisional extraction, and source-linked corrections. Acceptance: wrong scale, changed source, and uncertain extraction remain visible and cannot silently become confirmed measurements.
4. **Review and sharing:** scoped invitations, anchored comments, findings, reviewed export manifests, and CRM handoff. Acceptance: revocation blocks new access; revised drawings invalidate affected review; draft export is distinguishable from reviewed output.
5. **Visual options and expanded drafting:** derived 3D/concept views, tested output fidelity, additional drawing types, and reviewed requirements for each expanded use case.

Benchmark with permissioned real cases, known expected geometry, valid controls, conflicting revisions, and deliberately missing evidence. Measure extraction corrections, successful edits, export fidelity, reviewer time, and cost per completed project. Hold out entire projects from training. Do not make fine-tuning a prerequisite for the initial studio.

## First milestone

An owner can draw one room, confirm dimensions, add doors/windows, request and preview one AI layout change, save two alternatives, and share a draft with a collaborator. This creates the actual drafting product and an artifact people can use to make a decision.
