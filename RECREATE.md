# Recreate / publish Sight Flash

If this environment has no `gh` auth, finish UX/docs locally, then publish from a machine where you are logged in.

## Preferred: new public repo

```bash
cd /path/to/sight-flash   # this folder (or ~/sight-reading-app sync)
git init
git add .
git commit -m "Add Sight Flash bass sight-reading MVP with UX polish"
gh auth login   # if needed
gh repo create alexonov/sight-flash --public --source=. --remote=origin --push
```

If `sight-flash` is taken:

```bash
gh repo create alexonov/sight-reading-coach --public --source=. --remote=origin --push
```

## After push

```bash
git clone https://github.com/alexonov/sight-flash.git
cd sight-flash
npm install
npm run dev
```

## Agent Store path (Music project)

Source of truth while building: `docs/sight-reading-app/` in the project Agent Store.
