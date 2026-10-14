# The typeface used by Context

Context serves Inter from this directory so reading the dashboard does not depend on a font CDN request.

`inter-variable.woff2` is the active Inter 4.1 variable font, downloaded unchanged on 14 October 2026 from the [official Inter distribution](https://rsms.me/inter/font-files/InterVariable.woff2?v=4.1). Its weight axis spans 100–900 and its optical-size axis spans 14–32.

[OFL-Inter-Web.txt](OFL-Inter-Web.txt) contains the accompanying SIL Open Font License. Keep it with the font when redistributing these assets.

## Where the font is used

The [dashboard stylesheet](../../src/index.css) declares the family and the [page entry](../../index.html) preloads the WOFF2 file. UI text falls back to Segoe UI and then the browser's sans-serif family if Inter cannot load.

This directory contains the active font, its license, and this guide. Extra font formats are not required by the current build.

The product's typography and spacing decisions are described in [Dashboard design](../../../../DASHBOARD_REDESIGN.md).
