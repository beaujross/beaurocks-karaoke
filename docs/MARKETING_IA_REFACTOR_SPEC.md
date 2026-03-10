# Marketing UX/IA Refactor Spec

## Objective
Shift marketing information architecture from persona-first navigation to intent-first flows:

1. `Market`: product narrative and host acquisition.
2. `Utility`: discover and join flows.
3. `App`: authenticated profile, submission, and moderation tools.

This spec is implemented as a non-breaking refinement layer. Existing routes remain valid.

Marketing root behavior:

- `/` acts as the BeauRocks overview page.
- The root page should explain the hosted-night outcome first, then route people toward host setup, demo, and discover flows.
- `for_fans` is currently the root overview surface, not just a narrow audience persona page.

## Canonical Route Map
| Route Key | Canonical Path | IA Zone | Component Owner |
| --- | --- | --- | --- |
| `for_hosts` | `/for-hosts` | `market` | `ForHostsPage` |
| `host_access` | `/host-access` | `market` | Internal auth/access gate alias |
| `demo` | `/demo` | `market` | `DemoExperiencePage` |
| `changelog` | `/changelog` | `market` | `ChangelogPage` |
| `discover` | `/discover` | `utility` | `DiscoverPage` |
| `join` | `/join` | `utility` | `JoinPage` |
| `for_venues` | `/for-venues` | `market` | `ForVenuesPage` |
| `for_performers` | `/for-performers` | `market` | `ForPerformersPage` |
| `for_fans` | `/for-fans` | `market` | `ForFansPage` |
| `venue` | `/venues/:id` | `utility` | `VenuePage` |
| `event` | `/events/:id` | `utility` | `EventPage` |
| `host` | `/hosts/:id` | `utility` | `HostPage` |
| `performer` | `/performers/:id` | `utility` | `PerformerPage` |
| `session` | `/sessions/:id` | `utility` | `RoomSessionPage` |
| `profile` | `/profile` | `app` | `ProfileDashboardPage` |
| `submit` | `/submit` | `app` | `ListingSubmissionPage` |
| `admin` | `/admin/moderation` | `app` | `AdminModerationPage` |
| `geo_region` | `/karaoke/:region` | `utility` | `GeoLandingPage` |
| `geo_city` | `/karaoke/us/:state/:city` | `utility` | `GeoLandingPage` |

## Navigation Config Object
Source of truth now lives in:

- `src/apps/Marketing/iaModel.js`

Current nav intent:

1. Public primary: `Product`, `Demo`, `Discover`, `Join`.
2. Public secondary in header: none.
3. Authenticated secondary: `Dashboard`.
4. Moderator secondary: `Marketing Admin`.
5. Persona links and changelog live in footer links.

## Page Ownership Table
| IA Zone | Scope | Notes |
| --- | --- | --- |
| `market` | Public acquisition and positioning pages | Keep top-nav focused on host acquisition and product proof. |
| `utility` | Public task completion pages | Optimize for discover/find/join actions. |
| `app` | Authenticated operations pages | Not primary acquisition nav; reached via auth and task flows. |

## Zero-Breaking Redirect Policy
Strategy: keep legacy aliases live while canonicalizing links and analytics to path routes.

| Legacy Entry | Canonical Destination | Strategy |
| --- | --- | --- |
| `/marketing?page=for_fans` | `/for-fans` | `alias_keep_live` |
| `/marketing?page=for_hosts` | `/for-hosts` | `alias_keep_live` |
| `/marketing?page=discover` | `/discover` | `alias_keep_live` |
| `/marketing?page=join` | `/join` | `alias_keep_live` |
| `/marketing?page=host_access` | `/for-hosts` | `alias_keep_live` |

## Implementation Notes
1. No route removal in this phase.
2. Navigation behavior is centralized through `getMarketingNavModel()`.
3. Brand click now routes to the root overview page so the main product story stays one click away.
4. `host_access` remains an internal auth/access alias while public canonical host path is `/for-hosts`.
