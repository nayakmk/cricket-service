# V2 Collections Migration Guide

This guide explains how to migrate from v1 collections to v2 collections with the new nested team structure.

## Overview

The v2 collections feature a cleaner data structure where team information is nested hierarchically:

### V1 Structure (Flat)
```json
{
  "team1": { "id": "...", "name": "..." },
  "team1Squad": { "teamId": "...", "name": "...", "captainName": "..." },
  "team1SquadId": "...",
  "team1Score": 0
}
```

### V2 Structure (Nested)
```json
{
  "team1": {
    "id": "...",
    "name": "...",
    "shortName": "...",
    "squad": { "teamId": "...", "name": "...", "captainName": "..." },
    "squadId": "...",
    "score": 0
  }
}
```

## Migration Process

### Step 1: Prepare V1 Data
Ensure your v1 collections (`teams`, `players`, `matches`) are populated and up-to-date:

```bash
# Run v1 data import/population scripts first
node scripts/complete-data-reimport.js
node scripts/populate-all-team-players.js
node scripts/populate-comprehensive-team-stats.js
```

### Step 2: Run V2 Migration
Execute the migration script to copy data from v1 to v2 collections:

```bash
node scripts-v2/run-v2-migration.js
```

This script will:
- Migrate teams from `teams` → `teams_v2`
- Migrate players from `players` → `players_v2`
- Migrate matches from `matches` → `matches_v2` with nested team structure
- Transform old flat team data to new nested format

### Step 3: Verify Migration
Check that the migration was successful:

```bash
node scripts-v2/run-v2-verification.js
```

This will verify:
- All collections have been migrated
- Nested team structure is correct
- Legacy fields have been removed

## Scripts Overview

### Migration Scripts
- `migrate-to-v2-collections.js` - Core migration logic
- `run-v2-migration.js` - Executable migration runner

### Verification Scripts
- `verify-v2-migration.js` - Core verification logic
- `run-v2-verification.js` - Executable verification runner

### Utility Scripts
- `check-collections-v2.js` - Check v2 collection status
- `clear-collections-v2.js` - Clear v2 collections (for testing)
- `test-v2-apis.js` - Test v2 API endpoints

## Important Notes

1. **V1 Collections Preserved**: The original v1 collections remain untouched during migration
2. **Backward Compatibility**: V2 APIs handle both old and new data formats
3. **Idempotent**: Migration can be run multiple times safely
4. **Batch Processing**: Large datasets are processed in batches to avoid Firestore limits

## Troubleshooting

### Migration Fails
- Check Firebase credentials in `.env`
- Ensure v1 collections exist and have data
- Check console logs for specific error messages

### Verification Fails
- Re-run migration if data is missing
- Check that nested team structure transformation worked
- Verify API endpoints are using v2 collections

### Duplicate Data Issues
If you encounter duplicate entries in v2 collections (causing React key errors):

```bash
# Check for duplicates
node scripts-v2/check-duplicates-v2.js

# Clean up duplicates (removes all but the first occurrence of each numericId)
node scripts-v2/cleanup-v2-duplicates.js
```

**Important**: The migration scripts now include duplicate prevention, but if duplicates exist from previous runs, use the cleanup script.

### Performance Issues
- Migration processes data in batches of 10 documents
- Large datasets may take time to migrate
- Monitor Firebase usage during migration

## Next Steps

After successful migration:
1. Update client applications to use v2 API endpoints
2. Test all functionality with v2 data
3. Consider archiving v1 collections after full verification
4. Update documentation to reference v2 collections

## Support

For issues with v2 migration:
1. Check the console output for error messages
2. Verify Firebase configuration
3. Ensure all dependencies are installed
4. Review the migration logs for failed documents