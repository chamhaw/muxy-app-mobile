# Upstream release maintenance

`main` points to the exact commit of the selected upstream stable GitHub release tag. It contains no fork changes. `master` contains that commit and the local Muxy Mobile changes. Build and release workflows run from `master`.

Run upgrades from a clean, isolated `master` worktree:

```bash
bash scripts/upgrade-upstream.sh vX.Y.Z
```

The script requires the supplied tag to equal the latest published, non-draft, non-prerelease release in `muxy-app/mobile`. It fetches that tag, prints its tag object and peeled commit SHA, advances local `main` only when the old release is an ancestor, and merges `main` into `master`. Conflicts abort the merge and restore both branches. It creates a `backup/main-before-...` branch and never pushes. Review the resulting source, run the relevant builds, and inspect both upstream changes and fork behavior before publishing.

The release workflows reject runs outside `master`. The release tag created by a workflow points to the fork build commit; it is distinct from the upstream tag on `main`. The APK build uses the local arm64-only build script described in the `muxy-android-apk-build` skill.

Command references: `git fetch -h`, `git branch -h`, `git merge -h`, `git merge-base -h`, `gh release view --help`; [GitHub latest release API](https://docs.github.com/en/rest/releases/releases#get-the-latest-release) and [GitHub reusable workflow context](https://docs.github.com/en/actions/reference/workflows-and-actions/reusing-workflow-configurations).
