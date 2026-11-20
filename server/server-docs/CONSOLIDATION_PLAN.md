# Server Consolidation Plan

## Overview
This plan outlines the steps to move the working-server code to be the main server implementation while preserving functionality.

## Current State
- **Active Server**: `/server/working-server/` (JavaScript)
- **Original Server**: `/server/src/` (TypeScript - outdated)
- **Simple Server**: `/server/simple-server.js` (Minimal implementation)

## Consolidation Strategy

### Phase 1: Backup Current State
1. Create backup of entire server directory
2. Document current working endpoints
3. Note any active environment variables

### Phase 2: Move Working Server to Main
1. Move all JavaScript files from `working-server/` to `/server/`
2. Update import paths in moved files
3. Merge package.json dependencies
4. Move configuration files
5. Move Tesseract data files
6. Update scripts in package.json

### Phase 3: Archive Old Code
1. Move TypeScript implementation to `/server/archived/typescript-server/`
2. Move simple-server.js to `/server/archived/`
3. Keep for reference but remove from active codebase

### Phase 4: Test & Verify
1. Run server from new location
2. Test all API endpoints
3. Verify file uploads work
4. Check database connections
5. Ensure no breaking changes

## File Movement Map

### From working-server/ → server/
- `server.js` → `server.js`
- `routes/*.js` → `routes/*.js`
- `middleware/*.js` → `middleware/*.js`
- `services/*.js` → `services/*.js`
- `config/*.js` → `config/*.js`
- `utils/*.js` → `utils/*.js`
- `*.traineddata` → `tesseract-data/*.traineddata`
- `views/` → `views/`

### To Archive
- `src/` → `archived/typescript-server/src/`
- `simple-server.js` → `archived/simple-server.js`
- Original `package.json` → `archived/typescript-server/package.json`

## Risk Mitigation
1. Keep backups until verified working
2. Test in development before deploying
3. Document any path changes needed in frontend
4. Preserve all environment variables
5. Maintain same port configuration