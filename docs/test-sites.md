# Test sites — extraction QA reference

Internal reference URLs for evaluating website extraction quality in the prototype. Use the home editor (`/`), guided demo (`/demo`), `/api-test`, or `POST /api/design-intake/extract` / `POST /api/analyze-website` with the same URLs.

**Not a guarantee of results.** Some retail or enterprise sites block bots, return sparse HTML, or produce noisy navigation copy. Treat failures as signals for hardening — not as bugs in isolation.

---

## Sites to test

| URL | Why test it | What to inspect |
| --- | --- | --- |
| https://expoprint.io | Client baseline | Logo ranking (header wordmark vs favicon), services/products cleanup, phone/email/social, typography signals, multi-page `pagesInspected`, canvas bullet layout and brand colors |
| https://stripe.com | Modern B2B/SaaS | Typography (sans stack), logo candidates, services/products line quality, conservative contact fields |
| https://www.google.com | Logo ranking stress test | Product/app icons vs Google wordmark; weak candidates hidden in review UI when a strong header loads |
| https://www.shopify.com | Ecommerce / SaaS | Services/products phrasing, typography, brand color hints, headline/supporting recommendations |
| https://www.nike.com | Strong consumer brand | Logo/header imagery vs noisy product or nav strings in services/products |
| https://www.warbyparker.com | Consumer brand | Products/services lists, visual identity / typography, readable supporting copy on canvas |
| https://www.mailchimp.com | Playful marketing brand | Style-appropriate tone, typography, marketing copy density in extracted rows |
| https://www.squarespace.com | Modern design / typography | Font signals, services/products, clean layout on generated concept |
| https://www.patagonia.com | Product-heavy catalog | Avoid product-grid or category noise in services/products; logo and brand tone still usable |
| https://www.cvs.com | Complex retail stress test | Fetch failures, blocking, or very noisy extraction; metadata warnings and mock/fallback behavior |

---

## QA checklist

Run through this list after **Analyze Website** (editor/demo) or **extract** (`/api-test` / curl):

- [ ] **Business name** — plausible and matches the brand; not a page title or nav label
- [ ] **Logo candidates ranked well** — best match is a real brand mark, not a random UI icon
- [ ] **Transparent / header / logo candidates prioritized** — wordmarks and header images above small favicons and app icons
- [ ] **Typography signals** — detected families or a clear empty/mock state; counts match cleaned lists in API JSON
- [ ] **Services / products readable** — comma- or bullet-friendly phrases; not garbled nav, JSON, or duplicate crumbs
- [ ] **Contact / social** — only present when found on site; phone/email/social not invented
- [ ] **Pages inspected metadata** — `pagesFetched` / `pagesInspected` reasonable (homepage + up to a few same-origin pages); warnings make sense on failure
- [ ] **Canvas output readable** — headline, supporting line or bullets, contrast, contact strip not overflowing
- [ ] **Selected logo renders or falls back safely** — proxied image in logo area when load succeeds; placeholder + short message when not

---

## Suggested workflow

1. Pick a URL from the table.
2. Run extract on `/api-test` or analyze on `/` with **Outdoor tent** or **Trade show booth** and a style preset.
3. Review logo grid, typography row, extracted rows, and status line (`Claude` vs mock, pages inspected).
4. **Generate Sample Concept** and check canvas + exports (PNG still CORS-clean when logo loads).
5. Note issues in `docs/work-log.md` or Clockify — do not treat prototype output as production-ready.

Related docs: [`design-intake-api.md`](./design-intake-api.md), [`work-log.md`](./work-log.md).
