# Upstream release maintenance

`main` points to the exact commit of the selected upstream stable GitHub release tag. It contains no fork changes. `master` contains that commit and the local Muxy Mobile changes. Build and release workflows run from `master`.

The current baseline is `v3.3.0`, commit `9e99393164cb0e9caed9345971f67f466f391555`. The previous baseline was `v3.1.0`, commit `e40af75c8675cf23f4111580aca7a0ba05ffc3b8`. Android and iOS pin the Muxy SDK `2.5.0-beta.1321` with the upstream release checksums.

## Fork behavior

- Android's application container disables billing enforcement. Startup does not wait for trial data when billing is disabled. Expired trials do not block connections, the entitlement footer is hidden, and foreground entry does not refresh Google Play billing. Purchase infrastructure remains upstream-owned.
- Release workflows require `master`; native Android and iOS checks target `master`.
- The React Native/xterm input and output patches are retired with the upstream React Native client. Kotlin's terminal input session handles IME composition and modifier encoding; the native terminal emulator handles output and snapshots. Device validation must cover Chinese composition, Ctrl/Alt keys, reconnect output, and scrollback.
- The uncommitted `fix/mobile-terminal-ime` worktree remains a recovery source for historical terminal behavior and is not a build source.

## Local Android APK

The project pins standard HotSpot JDK `oracle-21.0.11` in `.mise.toml`; the sideload build invokes Gradle through mise. GraalVM is not a build runtime. Android requires Platform 37, Build Tools 36.0.0, Android command-line tools, and NDK `30.0.16248370`. Install the pinned SDK with `android/scripts/sdk.sh install`.

```bash
bash android/scripts/build-sideload-apk.sh /path/to/existing/debug.keystore
```

The script builds a non-debuggable, minified `3.3.0` APK with only `arm64-v8a`, signs it with the supplied Android debug keystore, verifies its signature and release component registrations, and writes `android/app/build/outputs/apk/release/muxyapp.apk`. Use the same signing key as the previous sideload build for in-place updates. The APK requires Android 10 or newer; it is not a Play Store artifact. Run native unit tests with `mise exec -- android/scripts/run.sh test` and checks with `mise exec -- android/scripts/checks.sh`. New fork regression tests follow device visual acceptance.

## Upstream upgrades

Run upgrades from a clean, isolated `master` worktree:

```bash
bash scripts/upgrade-upstream.sh vX.Y.Z
```

The script requires the supplied tag to equal the latest published, non-draft, non-prerelease release in `muxy-app/mobile`. It fetches that tag, prints its tag object and peeled commit SHA, advances local `main` only when the old release is an ancestor, and merges `main` into `master`. Conflicts abort the merge and restore both branches. It creates a `backup/main-before-...` branch and never pushes. Review the resulting source, run the relevant builds, and inspect both upstream changes and fork behavior before publishing.

The release workflows reject runs outside `master`. The release tag created by a workflow points to the fork build commit; it is distinct from the upstream tag on `main`. Local APK builds use the native script above; the former Expo build script does not apply to this baseline.

Command references: `git fetch -h`, `git branch -h`, `git merge -h`, `git merge-base -h`, `gh release view --help`; [GitHub latest release API](https://docs.github.com/en/rest/releases/releases#get-the-latest-release) and [GitHub reusable workflow context](https://docs.github.com/en/actions/reference/workflows-and-actions/reusing-workflow-configurations).
