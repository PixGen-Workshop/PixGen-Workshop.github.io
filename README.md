# PixGen workshop website

Source of the website for **PixGen: Rethinking the Generation Space for Visual Generative Models**, a half-day workshop proposed for CVPR 2027. The site is a static page with no build step: `index.html`, one stylesheet, one script, and the portraits.

Live site: https://pixgen-workshop.github.io/

## Editing

| What to change | Where |
| --- | --- |
| Any text, dates, schedule rows, speakers, organizers | `index.html` (the people are plain `<li class="person">` blocks) |
| Colours, type, spacing, the glass navigation | `assets/css/style.css` (design tokens are at the top of the file) |
| The hero pixel field and the tab bar behaviour | `assets/js/main.js` |
| Portraits | `assets/img/people/` (square JPEGs, 480×480 or 320×320) |
| Social preview image | `assets/img/og.png` (1200×630) |

To add a person, copy one of the existing `<li class="person">` blocks, drop a square portrait into `assets/img/people/`, and update the name, affiliation, and link.

To mark the proposal as accepted, search `index.html` for "under review", "tentative", and "proposed" and update those sentences.

## Previewing locally

Open `index.html` directly in a browser, or serve the folder:

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000/.

## Deployment

Every push to `main` runs `.github/workflows/deploy.yml`, which uploads the folder to GitHub Pages with the official Pages actions. One-time setup in the repository settings: **Settings → Pages → Build and deployment → Source: GitHub Actions**. The workflow also tries to enable Pages on its own when the token allows it.

The repository is named `PixGen-Workshop.github.io` under the `PixGen-Workshop` organization, so the site is served at the root of https://pixgen-workshop.github.io/. All links in the site are relative, so it also works from a project path such as `/PixGen/` if the repository is ever renamed.
