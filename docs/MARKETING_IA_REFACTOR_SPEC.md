# Marketing UX/IA Refactor Spec

## Objective
Shift marketing information architecture from persona-first navigation to intent-first flows:

1. `Market`: product narrative and host acquisition.
2. `Utility`: discover and join flows.
3. `App`: authenticated profile, submission, and moderation tools.

This spec is implemented as a non-breaking refinement layer. Existing routes remain valid.

## Canonical Route Map
| Route Key | Canonical Path | IA Zone | Component Owner |
| --- | --- | --- | --- |
| `for_hosts` | `/for-hosts` | `market` | `ForHostsPage` |
| `host_access` | `/host-access` | `market` | `ForHostsPage` with access gate shell |
| `demo` | `/demo` | `market` | `DemoExperiencePage` |
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
2. Public secondary: `For Venues`, `For Performers`, `For Guests`.
3. Locked secondary: `For Guests`.
4. Authenticated secondary: `Dashboard`.
5. Moderator secondary: `Marketing Admin`.

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
| `/marketing?page=host_access` | `/host-access` | `alias_keep_live` |

## Implementation Notes
1. No route removal in this phase.
2. Navigation behavior is centralized through `getMarketingNavModel()`.
3. Brand click now routes to host product path (`/for-hosts`) to support host-first positioning.
4. `host_access` and `for_hosts` consolidation remains a follow-up architecture step after content and conversion validation.
