# oscarolbe.github.io

My developer profile and CV: https://oscarolbe.github.io/

The CV follows the [Schema Resume](https://schema-resume.org/) 1.3 standard.

| File | What it is |
|---|---|
| `resume.json` | The full CV. Every fact lives here. |
| `cv/<area>.json` | A focused CV (backend, frontend, devops, gaming): a different title, summary, highlights, projects and skills on top of `resume.json`. See the top of `build.mjs` for the fields. |
| `style.css` | The page style. |
| `build.mjs` | Builds the pages. |

After editing any of them, run:

```sh
node build.mjs
```

It writes `index.html` (full CV) and, for each area, `<area>/index.html` and `<area>/resume.json`.
Commit the output: GitHub Pages serves the repo as-is. Each page also embeds its CV as JSON-LD.

The **Check CV** GitHub Action fails if the pages weren't rebuilt or a CV is not valid Schema Resume.

To add an area, copy one of the files in `cv/`, change it, and run the build.
