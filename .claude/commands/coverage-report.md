Run the code coverage report script to fetch line coverage data from GitHub Actions for all configured repos.

## Instructions

1. Run the script: `bash .claude/scripts/code-coverage-report.sh --table`
2. Present the results to the user in a clear table format
3. Highlight any repos with notable coverage changes or gaps:
   - Coverage below 30% is concerning
   - Coverage above 80% is strong
   - "N/A" means no coverage data was published for that build
4. If the user asks for a specific format, re-run with `--markdown`, `--csv`, or `--json`

## Adding repos

Edit `.claude/scripts/code-coverage-report.sh` and add entries to the `REPOS` array in the format `"repo-name:N/A"`. To find a pipeline definition ID, run:

```bash
az devops invoke --area build --resource definitions --route-parameters project=mahjong-site --query-parameters "name=REPO_NAME&api-version=7.0" --api-version 7.0 -o json
```

## Changing the branch

The script filters to the latest successful build on `master` by default (set via the `BRANCH` variable at the top of the script). Change it there if a repo uses `main` or another default branch.

## Prerequisites

- Azure CLI authenticated (`az login`)
- Azure DevOps defaults configured (`az devops configure --defaults organization=https://dev.azure.com/your-org project=mahjong-site`)
- Node.js available (used for JSON parsing)

## Note

The underlying fetch script (`.claude/scripts/code-coverage-report.sh`) is written for Azure DevOps pipelines — if your CI platform differs, you'll need an equivalent fetch script; this command's presentation logic (the coverage table format) is otherwise reusable as-is.
