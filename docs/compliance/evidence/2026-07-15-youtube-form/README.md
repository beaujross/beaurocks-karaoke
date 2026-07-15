# Google Form Presentation Captures

The public/product captures below were generated from isolated production browser windows at 1280×800 and visually reviewed. The Cloud Console capture remains manual because it requires the Google account that owns or administers the project.

Required filenames:

1. `01-google-cloud-youtube-quotas-address-bar.png`
   - status: captured from the signed-in project-owner session and reviewed 2026-07-15
   - Google Cloud Console
   - project `beaurocks-karaoke-v2` / `426849563936`
   - shows Search Queries `100/day`
   - supplemental `01b-google-cloud-youtube-general-quota-address-bar.png` shows general Queries `10,000/day`; both images are unaltered browser-window captures with the address bar visible
2. `02-privacy-policy-address-bar.png`
   - status: captured and reviewed 2026-07-15
   - https://beaurocks.app/karaoke/privacy
   - show YouTube API Services, Google Privacy Policy, and deletion/retention language
3. `03-host-youtube-policy-links-address-bar.png`
   - status: captured and reviewed 2026-07-15
   - https://host.beaurocks.app
   - controlled production audit fixture for Room Library Curator
   - show YouTube context plus Privacy/Terms links
4. `04-terms-address-bar.png`
   - status: captured and reviewed 2026-07-15
   - https://beaurocks.app/karaoke/terms
   - show YouTube API Services and policy links
5. `05-youtube-player-address-bar.png`
   - status: captured and reviewed 2026-07-15
   - production public TV or relevant player surface
   - show the validated YouTube-backed playback context
   - controlled production audit fixture uses the catalog-approved, embeddable Dreams backing (`WPt-FVlp2Pw`) instead of the fixture's non-network placeholder ID
6. `06-host-curator-address-bar.png`
   - status: captured and reviewed 2026-07-15
   - controlled production audit fixture for Room Library Curator readiness
   - show quota-aware fallback, known catalog, and content-agnostic alternatives

Capture guidance:

- Use the Windows snipping tool or `scripts/ops/capture-youtube-form-browser-window.ps1` and include browser chrome.
- Keep all relevant text readable without zooming below legibility.
- Do not show API keys, passwords, tokens, private room codes, or unrelated personal tabs.
- Verify each image is at least 1280×720 and under 10 MB.
- Do not overwrite the original 2026-07-06 evidence; these files are presentation captures for the current Google form.
