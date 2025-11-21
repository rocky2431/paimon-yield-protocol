# Context Archive Directory

This directory stores compressed context summaries from compressing-context Skill.

## Purpose
- Archive completed task details to free up conversation context
- Enable 20-30 tasks per session (vs 10-15 without compression)
- Provide historical reference for project decisions

## File Naming Convention
```
session-{timestamp}.md
```

Example:
```
session-2025-11-14T10-30-00.md
session-2025-11-14T15-45-30.md
```

## File Format
Each archive contains:
- Meta information (timestamps, token stats)
- Completed tasks summary (compact format)
- Technical decisions log
- Code snippets (if critical)
- Skills activation summary
- Next session context

## Usage

### For Developers
When compressing-context triggers:
1. Completed tasks are summarized (15K → 500 tokens per task)
2. Full details archived to this directory
3. Only summary remains in conversation

### For Future Reference
To recall compressed information:
```typescript
// Read the archive
Read(".ultra/context-archive/session-2025-11-14T10-30-00.md")

// Search for specific task
Grep("Task #5", { path: ".ultra/context-archive/" })
```

## Maintenance

### Auto-cleanup (Optional)
Archives older than 30 days can be deleted:
```bash
find .ultra/context-archive -type f -mtime +30 -delete
```

### Size Management
Typical archive sizes:
- 5 tasks: ~3KB
- 10 tasks: ~6KB
- 20 tasks: ~12KB

Expected total: <50KB per project

## Integration

### With compressing-context Skill
- **Auto-creates** archives when triggered
- **Validates** file integrity
- **Logs** compression stats

### With git
- **Gitignored** by default (local context only)
- **Not synced** across team members
- **Each developer** has own archives

## Example Archive Preview

```markdown
# Context Archive - Session 2025-11-14 10:30

## Meta Information
- Original Tokens: 145,000
- Compressed Tokens: 62,000
- Compression Ratio: 57%

## Completed Tasks (5)
### Task #1: Implement JWT Authentication
- ✅ Completed | Branch: feat/task-1-auth
- Files: AuthService.ts, middleware.ts, auth.test.ts
- Tests: Pass (92% coverage)
- Commit: abc123 "feat: add JWT auth"

[... Tasks #2-5 ...]

## Technical Decisions
- Chose JWT over sessions (performance)
- RS256 for public key verification

## Next Session Context
- Continue with Task #6: Payment integration
- Remaining: 15 tasks
```

---

**Note**: This directory is created automatically by compressing-context Skill. Manual intervention rarely needed.
