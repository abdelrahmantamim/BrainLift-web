# Mobile Fixes Test Suite

This directory contains comprehensive test scripts to verify the backend functionality supporting the mobile UI fixes.

## 📁 Test Scripts Overview

### 1. `run-mobile-tests.js` (Main Runner)
**Purpose**: Orchestrates all mobile-related tests and provides a comprehensive report.

**Usage**:
```bash
node server/scripts/run-mobile-tests.js
```

**Features**:
- Runs all test suites sequentially
- Provides detailed timing and success metrics
- Generates comprehensive reports
- Handles test timeouts and errors gracefully

---

### 2. `test-mobile-fixes.js` (Core Functionality)
**Purpose**: Tests core backend functionality supporting mobile features.

**What it tests**:
- Flashcard generation from content
- AI-powered title generation
- Concise mode implementation
- File processing capabilities

**Usage**:
```bash
node server/scripts/test-mobile-fixes.js
```

**Key Features**:
- Direct AI service testing
- Flashcard validation logic
- Content processing simulation
- File type validation

---

### 3. `test-flashcard-endpoints.js` (API Testing)
**Purpose**: Tests flashcard generation endpoints with real HTTP requests.

**What it tests**:
- `/api/flashcards/generate` endpoint
- Authentication handling
- Request/response validation
- Title generation within API flow

**Usage**:
```bash
node server/scripts/test-flashcard-endpoints.js
```

**Configuration**:
```javascript
const CONFIG = {
  SERVER_URL: process.env.SERVER_URL || 'http://localhost:3001',
  TEST_USER_EMAIL: 'test@brainlift.app',
  TEST_USER_PASSWORD: 'TestPassword123!',
  TIMEOUT: 30000
};
```

---

### 4. `test-concise-mode.js` (Chat Features)
**Purpose**: Tests concise vs detailed response modes in chat functionality.

**What it tests**:
- `/api/chat/message` endpoint with `aiResponseStyle` parameter
- Response length comparison
- Content quality validation
- Performance metrics

**Usage**:
```bash
node server/scripts/test-concise-mode.js
```

**Test Questions**:
- "Explain how photosynthesis works"
- "What is the difference between mitosis and meiosis?"
- "How does the water cycle work?"
- "Explain the theory of evolution"
- "What causes climate change?"

---

### 5. `mobile-ui-test-checklist.md` (Manual Testing Guide)
**Purpose**: Comprehensive manual testing checklist for mobile UI fixes.

**Sections**:
- Automated test instructions
- Step-by-step manual UI tests
- Backend API verification
- Success criteria
- Test report template

---

## 🚀 Quick Start

### Prerequisites
- Node.js 14+ with ES modules support
- Running server instance (usually on port 3001)
- Test user account in database (optional, tests can run without auth)

### Run All Tests
```bash
# Run comprehensive test suite
node server/scripts/run-mobile-tests.js

# Expected output:
# ✅ ALL TESTS PASSED - Mobile fixes are working correctly!
```

### Run Individual Tests
```bash
# Core functionality only
node server/scripts/test-mobile-fixes.js

# API endpoints only
node server/scripts/test-flashcard-endpoints.js

# Concise mode only
node server/scripts/test-concise-mode.js
```

### Environment Variables
```bash
# Optional: Override default server URL
export SERVER_URL=https://your-server.com

# Optional: Use different test credentials
export TEST_USER_EMAIL=your-test@email.com
export TEST_USER_PASSWORD=YourTestPassword
```

---

## 📊 Understanding Test Results

### Success Indicators
- ✅ **Exit code 0**: All tests passed
- 📊 **95%+ success rate**: Most functionality working
- 🎯 **<30s response times**: Good performance
- 📝 **Meaningful content**: AI generation working

### Failure Indicators
- ❌ **Exit code 1**: Some tests failed
- 🚫 **High error rates**: System instability
- ⏰ **Timeouts**: Performance issues
- 🔍 **Validation failures**: Data quality problems

### Sample Output
```
🏆 FINAL RESULT: ✅ PASSED

📊 OVERALL STATISTICS
====================
Tests passed: 3/3
Success rate: 100%
Total time: 45s
Average time per test: 15s

🎉 MOBILE FEATURES VERIFIED:
   ✓ Flashcard generation from files works
   ✓ AI-powered flashcard title generation works
   ✓ Concise mode reduces response verbosity
   ✓ File processing pipeline is functional
   ✓ Backend endpoints respond correctly
```

---

## 🔧 Troubleshooting

### Common Issues

**Authentication Failures**
```bash
# Create test user if needed
node server/scripts/create-user.js

# Or run tests without authentication (limited functionality)
```

**Server Connection Issues**
```bash
# Verify server is running
curl http://localhost:3001/health

# Check server logs
tail -f server/logs/error.log
```

**Timeout Issues**
```bash
# Increase timeout in test configs
const CONFIG = {
  TIMEOUT: 60000 // 60 seconds instead of 30
};
```

**AI Service Issues**
```bash
# Check environment variables
echo $OPENAI_API_KEY
echo $OPEN_ROUTER_API

# Test AI models directly
node server/scripts/test-ai-models.js
```

### Debug Mode
Add debug logging to any test:
```javascript
// Add to beginning of test script
process.env.NODE_ENV = 'development';
process.env.DEBUG = 'true';
```

---

## 📝 Test Configuration

### Default Test Parameters
- **Flashcard count**: 8 cards per generation
- **Content length**: ~2500 characters for testing
- **Timeout**: 30 seconds per operation
- **Success threshold**: 75% of tests must pass

### Customization
Modify test parameters in each script:
```javascript
const TEST_CONFIG = {
  EXPECTED_FLASHCARD_COUNT: 10,
  TIMEOUT: 45000,
  TEST_CONTENT: "Your custom test content..."
};
```

---

## 🎯 Mobile UI Features Tested

### 1. Chat File Context UI
- **Backend**: File processing and content extraction
- **Test**: Validates content processing pipeline
- **Mobile Impact**: Ensures file context button has data to display

### 2. Files Modal
- **Backend**: File validation and upload handling
- **Test**: File type and size validation
- **Mobile Impact**: Ensures modal has proper data validation

### 3. Flashcard Generation
- **Backend**: AI-powered flashcard creation and title generation
- **Test**: End-to-end generation pipeline
- **Mobile Impact**: Supports animated loading and result display

### 4. Concise Mode
- **Backend**: AI response style modification
- **Test**: Compares response lengths and quality
- **Mobile Impact**: Improves readability on small screens

### 5. File Upload Options
- **Backend**: Multiple file format support and processing
- **Test**: Validation of supported file types
- **Mobile Impact**: Enables diverse file upload methods

---

## 📋 Test Coverage

| Feature | Backend Test | API Test | Performance Test | UI Impact |
|---------|-------------|----------|------------------|-----------|
| Flashcard Generation | ✅ | ✅ | ✅ | High |
| Title Generation | ✅ | ✅ | ✅ | Medium |
| Concise Mode | ✅ | ✅ | ✅ | High |
| File Processing | ✅ | ⚠️ | ✅ | High |
| Error Handling | ✅ | ✅ | ❌ | Medium |

**Legend**:
- ✅ Fully tested
- ⚠️ Partially tested  
- ❌ Not tested

---

## 🔄 Continuous Testing

### Integration with Development
```bash
# Add to package.json scripts
{
  "scripts": {
    "test:mobile": "node server/scripts/run-mobile-tests.js",
    "test:mobile:fast": "node server/scripts/test-mobile-fixes.js"
  }
}
```

### CI/CD Integration
```yaml
# Example GitHub Actions step
- name: Run Mobile Tests
  run: npm run test:mobile
  timeout-minutes: 10
```

### Pre-deployment Testing
```bash
# Run before deploying mobile updates
npm run test:mobile && echo "✅ Safe to deploy" || echo "❌ Fix issues first"
```

---

## 📚 Related Documentation

- `../server-docs/MOBILE_INTEGRATION.md` - Mobile API integration guide
- `../routes/flashcards.routes.js` - Flashcard endpoint implementation
- `../routes/chat.routes.js` - Chat endpoint with concise mode
- `../services/ai/unifiedAIService.js` - AI service architecture
- `mobile-ui-test-checklist.md` - Manual testing procedures

---

## 💡 Best Practices

1. **Run tests before mobile deployments**
2. **Monitor test performance trends**
3. **Update test data regularly**
4. **Keep test scripts in sync with API changes**
5. **Use both automated and manual testing**
6. **Test on actual mobile devices when possible**

---

For questions or issues with the test suite, check the server logs or create an issue with:
- Test script name and error message
- Server configuration and environment
- Expected vs actual behavior
- Steps to reproduce