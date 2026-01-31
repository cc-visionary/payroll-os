# Release Guide

This guide covers how to create and manage releases for PeopleOS Payroll.

## Overview

Releases are automated via GitHub Actions. Every push to `main` triggers a build for:
- **Windows** (.exe installer)
- **macOS** (.dmg for Intel and Apple Silicon)
- **Linux** (.AppImage)

## Prerequisites

### 1. Set up GitHub Token

Add `GH_TOKEN` to your repository secrets:

1. Go to **Settings → Secrets and variables → Actions**
2. Click **New repository secret**
3. Name: `GH_TOKEN`
4. Value: Your GitHub Personal Access Token with `repo` scope

To create a token:
1. Go to **GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)**
2. Generate new token with `repo` scope
3. Copy and save it securely

## Creating a New Release

### Standard Release (Recommended)

1. **Update the version** in `package.json`:
   ```bash
   # For patch release (bug fixes): 0.1.0 → 0.1.1
   npm version patch

   # For minor release (new features): 0.1.0 → 0.2.0
   npm version minor

   # For major release (breaking changes): 0.1.0 → 1.0.0
   npm version major
   ```

   This automatically:
   - Updates `package.json`
   - Creates a git commit
   - Creates a git tag

2. **Push to main**:
   ```bash
   git push origin main --follow-tags
   ```

3. **Monitor the build** at: `https://github.com/cc-visionary/payroll-os/actions`

4. **Verify the release** at: `https://github.com/cc-visionary/payroll-os/releases`

### Manual Version Update

If you prefer manual control:

```bash
# 1. Edit package.json version manually
# 2. Commit the change
git add package.json
git commit -m "chore: bump version to X.Y.Z"

# 3. Create a tag
git tag -a vX.Y.Z -m "Release vX.Y.Z"

# 4. Push
git push origin main --follow-tags
```

### Trigger Release Manually

You can also trigger a release without pushing code:

1. Go to **Actions → Release → Run workflow**
2. Select the branch and click **Run workflow**

## Version Numbering (Semantic Versioning)

Follow [Semantic Versioning](https://semver.org/):

```
MAJOR.MINOR.PATCH
```

| Type | When to use | Example |
|------|-------------|---------|
| **PATCH** | Bug fixes, small tweaks | `0.1.0 → 0.1.1` |
| **MINOR** | New features (backward compatible) | `0.1.0 → 0.2.0` |
| **MAJOR** | Breaking changes | `0.1.0 → 1.0.0` |

### Version Examples

- `0.1.0` - Initial development
- `0.1.1` - Bug fix
- `0.2.0` - New feature added
- `1.0.0` - First stable release
- `1.1.0` - New feature in stable
- `2.0.0` - Breaking change

## Release Checklist

Before releasing, ensure:

- [ ] All tests pass locally (`npm test`)
- [ ] App builds successfully (`npm run build`)
- [ ] No TypeScript errors (`npm run lint`)
- [ ] Version in `package.json` is updated
- [ ] Changes are committed and pushed

## Monitoring Releases

### Check Build Status

```bash
# Using GitHub CLI
gh run list --workflow=release.yml

# View specific run
gh run view <run-id>
```

### Download Artifacts Locally

```bash
# List artifacts
gh run download <run-id>
```

## Troubleshooting

### Build Fails on One Platform

The workflow uses `fail-fast: false`, so other platforms will continue building. Check the failed job's logs:

1. Go to **Actions → Release → [Failed Run]**
2. Click on the failed job
3. Review the error logs

### GH_TOKEN Errors

If you see `GitHub Personal Access Token is not set`:

1. Verify the secret exists in repo settings
2. Ensure the token hasn't expired
3. Check the token has `repo` scope

### macOS Code Signing (Optional)

For notarized macOS builds, add these secrets:
- `APPLE_ID` - Your Apple ID
- `APPLE_APP_SPECIFIC_PASSWORD` - App-specific password
- `APPLE_TEAM_ID` - Your Team ID

Then update `electron-builder.yml`:
```yaml
mac:
  notarize: true
  identity: "Developer ID Application: Your Name (TEAM_ID)"
```

### Windows Code Signing (Optional)

For signed Windows builds, add:
- `WIN_CSC_LINK` - Base64-encoded .pfx certificate
- `WIN_CSC_KEY_PASSWORD` - Certificate password

## Auto-Updates

The app supports auto-updates via `electron-updater`. Users will be notified when a new version is available.

Update behavior:
1. App checks for updates on launch
2. If available, user is prompted to download
3. Update installs on next app restart

## Release Notes

After a release is published, edit it on GitHub to add release notes:

1. Go to **Releases → [Your Release] → Edit**
2. Add a description of changes:

```markdown
## What's New

### Features
- Added new payroll export format

### Fixes
- Fixed calculation error in overtime

### Improvements
- Improved loading performance
```

## Rollback

If a release has critical issues:

1. **Delete the release** on GitHub (keeps the tag)
2. **Fix the issue** in a new commit
3. **Create a new patch release** with the fix

Never force-push to main or delete tags that users may have downloaded.
