# Deploying

## The library

Releases go out from a tag: see "Releases" in `docs/DECISIONS.md`.

## The website

A static site built from `site/` and served by Caddy on Railway.

- Railway project `definitely-not-a-robot` (`ca91affa-f89d-4ec1-a5f3-1920d3ab88dd`), environment
  `production`, service `site`. Workspace: withSeismic.
- URL: https://site-production-4098.up.railway.app
- The service builds `site/Dockerfile` (set by the `RAILWAY_DOCKERFILE_PATH` variable on the
  service) with the repo root as the build context. Nothing deploys on push.

Locally:

```sh
pnpm site:dev       # http://localhost:5173, with the demo videos served from docs/media
pnpm site:build     # site/dist
pnpm site:og        # re-render site/public/og.png after changing the headline
```

To deploy, from a clean export of `main` (never from a working tree):

```sh
git fetch origin
rm -rf <scratch>/deploy && mkdir -p <scratch>/deploy
git archive origin/main | tar -x -C <scratch>/deploy
railway up <scratch>/deploy --path-as-root -p ca91affa-f89d-4ec1-a5f3-1920d3ab88dd -e production -s site --detach
```

`railway up` prints the deployment's id. Watch it until it reaches a final state:

```sh
railway deployment list -p ca91affa-f89d-4ec1-a5f3-1920d3ab88dd -e production -s site --json | jq '.[0] | {id, status}'
```

Then check the live site: `/`, `/changelog/`, a made-up path for the 404 page, `/og.png`,
`/sitemap.xml`, and that the demo moves both cursors when clicked.

The site reads the README, the changelog and the examples when it's built, so a change to any of
them shows up on the site at the next deploy.
