#!/usr/bin/env bash
set -euo pipefail

fail() {
  printf '%s\n' "$*" >&2
  exit 1
}

[[ $# -eq 1 ]] || fail "Usage: scripts/upgrade-upstream.sh <latest-stable-release-tag>"
target_tag="$1"
[[ "$target_tag" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || fail "Expected a stable vX.Y.Z release tag"

command -v gh >/dev/null || fail "gh is required"
[[ "$(git branch --show-current)" == master ]] || fail "Run from the fork master worktree"
[[ -z "$(git status --porcelain=v1 --untracked-files=all)" ]] || fail "Working tree must be clean"
[[ "$(git remote get-url upstream)" == "https://github.com/muxy-app/mobile.git" ]] || fail "Unexpected upstream remote"

old_main="$(git rev-parse --verify refs/heads/main)"
old_master="$(git rev-parse --verify refs/heads/master)"
git merge-base --is-ancestor "$old_main" "$old_master" || fail "main is not an ancestor of master"

release="$(gh release view --repo muxy-app/mobile --json tagName,isDraft,isPrerelease --jq '[.tagName,.isDraft,.isPrerelease] | @tsv')"
read -r release_tag is_draft is_prerelease <<< "$release"
[[ "$release_tag" == "$target_tag" && "$is_draft" == false && "$is_prerelease" == false ]] ||
  fail "Target tag is not the latest published stable GitHub release"

git fetch --no-tags upstream tag "$target_tag"
target_object="$(git rev-parse --verify "refs/tags/$target_tag")"
target_commit="$(git rev-parse --verify "refs/tags/$target_tag^{commit}")"
[[ "$target_commit" != "$old_main" ]] || fail "main already points to $target_tag"
git merge-base --is-ancestor "$old_main" "$target_commit" ||
  fail "Target release does not descend from the current main"

backup_branch="backup/main-before-$target_tag-${old_main:0:8}"
if git show-ref --verify --quiet "refs/heads/$backup_branch"; then
  fail "Backup branch already exists: $backup_branch"
fi

printf 'Release tag: %s\nTag object: %s\nCommit: %s\n' "$target_tag" "$target_object" "$target_commit"
printf 'Current main: %s\nCurrent master: %s\n' "$old_main" "$old_master"
git branch "$backup_branch" "$old_main"
git branch -f main "$target_commit"

if ! git merge --no-ff --no-edit main; then
  git diff --name-only --diff-filter=U >&2
  git merge --abort || fail "Merge abort failed; inspect master before continuing"
  git branch -f main "$old_main"
  fail "Merge conflicted; main and master restored, backup retained"
fi

git merge-base --is-ancestor main master || fail "Merged master does not contain main"
printf 'Updated main: %s\nUpdated master: %s\n' \
  "$(git rev-parse main)" "$(git rev-parse master)"
