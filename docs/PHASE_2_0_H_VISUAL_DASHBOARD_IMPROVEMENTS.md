# GUVEL Operational — Phase 2.0.H

## Scope
Visual and Production Dashboard improvements based on the approved layout reference.

## Included
- Status active machines use green visual treatment; inactive machines use gray.
- Production Dashboard command-center layout.
- OEE semi-gauge with Availability, Performance and Quality legend colors.
- Plan vs Actual odometer-style gauge.
- Planned downtime is excluded from available planned production time through the existing shift exclusion logic.
- Good Parts, Rejected Parts and Yield / FTQ visual tiles.
- Live Line Status: machine cards for Today / Previous Day; daily machine activity trend for broader periods.
- Model Mix pie chart based on production quantity by part number.

## Notes
The current production schema does not contain a dedicated planned quantity field. Plan vs Actual therefore uses theoretical planned output from available shift time (excluding configured planned time) divided by configured ideal cycle time. This is a visual baseline until a dedicated production plan model is introduced.

Invitations, tokens, links, onboarding and the removed redirect Hotfix 3 are intentionally out of scope and remain deferred.
