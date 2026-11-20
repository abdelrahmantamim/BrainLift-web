# Chat Prompt Optimization Migration Guide

## What Changed

### Before (4000+ tokens)
- Full chart specifications for 20+ chart types inline
- Redundant language rules repeated 3 times
- Legacy + new formats for most charts
- Everything loaded for every request

### After (~800-1000 tokens)
- Only 4 common charts in base prompt (pie, bar, line, flow)
- Single, clear language rule
- Rare charts loaded dynamically when detected
- 75-80% reduction in prompt size

## Files Created/Modified

### New Files
1. `/server/prompts/basePrompt.js` - Optimized base prompt functions
2. `/server/prompts/chartSpecifications.js` - Chart specs reference
3. `/server/prompts/optimizedChatPrompt.js` - Alternative standalone version

### Modified Files
1. `/server/routes/chat.routes.js` - Updated to use new prompt system

## How It Works

1. **Base Prompt**: Contains only essential instructions + 4 common charts
2. **Chart Detection**: Scans user message for chart keywords
3. **Dynamic Loading**: Adds specific chart examples only when needed
4. **Logging**: Shows when rare charts are detected and prompt size impact

## Testing Checklist

- [ ] Basic conversation (no charts)
- [ ] Common charts: pie, bar, line, flow
- [ ] Rare charts: mindmap, gantt, network, etc.
- [ ] Language switching
- [ ] PDF generation
- [ ] Response styles (concise vs detailed)
- [ ] Simple queries (math, greetings)

## Rollback Plan

If issues arise, simply revert the changes in chat.routes.js:
1. Remove the new imports
2. Restore the original baseSystemMessage
3. Remove chart detection logic

## Performance Metrics

Monitor these after deployment:
- Response initiation time
- Token usage per request
- User-perceived latency
- Chart rendering success rate

## Future Optimizations

1. Cache chart additions per session
2. Preload charts based on user history
3. Further reduce base prompt size
4. Move response style instructions to dynamic loading