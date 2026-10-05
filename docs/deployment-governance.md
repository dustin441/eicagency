# EIC Website Release Governance

## Production ownership

Dustin is the sole production launcher for both EIC websites. Contributors create branches and pull requests. They do not push directly to production branches or manually promote Vercel deployments.

| Person | Marketing contributions | Analytics contributions | Production launch |
| --- | --- | --- | --- |
| Dustin (`dustin441`) | Yes | Yes | Both sites |
| Adolfo (`adolfo-eic`) | Yes | Yes | No |
| Mike (`Mpattyfly1969`) | Yes | No | No |

## Production mapping

| Site | Git branch | Vercel project |
| --- | --- | --- |
| `eic.agency` | `marketing-production` | `eicagency-marketing` |
| `analytics.eic.agency` | `main` | `eicagency` |

## Required workflow

1. Fetch the current target branch.
2. Create a new branch or clean worktree from that exact target.
3. Make only the intended change.
4. Build, test, and verify the relevant routes and assets.
5. Push the review branch and open a pull request into the correct target.
6. Allow the Production Contract check to run.
7. Dustin reviews the diff and verification evidence.
8. Dustin squash-merges the approved PR.
9. Vercel deploys from the connected production branch.
10. Verify the exact deployed commit and stable domain.

## Prohibited release paths

- Direct pushes to `main` or `marketing-production`
- Force pushes or deletion of either production branch
- `vercel --prod` from a working copy
- Manual promotion or redeployment of a build from the wrong branch
- Manual production alias reassignment
- Replacing a production branch with a stale feature branch

## Cross-site changes

If a change affects both websites, use two pull requests, one for each production branch, or explicitly document why a shared-code integration is safe. Each deployment is verified independently.

## Emergency release

An emergency still uses a PR. Dustin may use the named pull-request-only bypass after recording the failure, the minimum fix, and the verification evidence. The bypass does not permit normal direct pushes.

## Incident this policy prevents

Mike's September 24 Tool Manufacturer Case Study was correctly committed to `marketing-production`. Two September 30 CLI production deployments built the marketing Vercel project from `main`, whose tree did not include that marketing commit. Restoring `marketing-production` on October 2 returned the card and image. This policy keeps production tied to a reviewed PR and the correct branch.
