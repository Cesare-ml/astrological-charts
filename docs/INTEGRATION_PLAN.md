# Planned integration into VirgoStars (not active)

The original VirgoStars monorepo remains the production source of truth for this library until extraction is validated and explicitly approved.

## Before integration

1. Make isolated library build succeed in a clean checkout.
2. Add synthetic fixture-based visual tests and browser PNG tests.
3. Audit asset rights and make an asset resolver/manifest work for web and headless Astrolabio.
4. Verify Angular site, PNG-mobile, Astrolabio UI, headless render and previously shipped device compatibility.
5. Version a library release and record a changelog.

## Preferred initial integration

Keep dependency version *pinned*, not floating. Decide between a private package or an explicit vendored/subtree import only after the above gates. Track exact revision and provide a rollback path. Ensure the Astrolabio offline build and existing devices can still obtain matching assets. No automatic deployment.

## Backward compatibility

The current `grafici-astrologici` public entry point remains the migration target. Do not remove model exports or change JSON contracts without a coordinated upstream PR and fixtures. Avoid cross-repository writes from untrusted contributor AI agents.

## Repository permissions

Invite trusted contributors to **this** repository only. They do not need access to VirgoStars backends, AWS infrastructure, user data or other private repositories.
