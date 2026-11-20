# API Key Management for Unified Parser Service

## Generated API Key

Your API key has been generated and saved securely:

```
API Key: up_4bD5wcQx8gs7lcHhb7mnh5GoLUPz2GZN
```

## How to Use

### 1. In your server's `.env` file

Add this line to your tutoring app server's `.env` file:

```env
UNIFIED_PARSER_API_KEY=up_4bD5wcQx8gs7lcHhb7mnh5GoLUPz2GZN
```

### 2. In your API calls

When making requests to the unified parser service, include the API key in the Authorization header:

```javascript
const response = await fetch('http://localhost:8002/parse', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer up_4bD5wcQx8gs7lcHhb7mnh5GoLUPz2GZN',
    'Content-Type': 'multipart/form-data'
  },
  body: formData
});
```

## Security Notes

1. **Keep it secret**: Never share this API key publicly or commit it to version control
2. **Use environment variables**: Always load the key from environment variables in production
3. **Rotate regularly**: Generate new keys periodically for better security
4. **Monitor usage**: Keep track of API key usage to detect any unauthorized access

## API Key Utilities

### Generate a new API key
```bash
python generate_api_key.py --description "Description of key purpose"
```

### Generate multiple keys
```bash
python generate_api_key.py --count 3 --description "Development keys"
```

### Verify an API key
```bash
python verify_api_key.py up_4bD5wcQx8gs7lcHhb7mnh5GoLUPz2GZN
```

### List all generated keys
```bash
python verify_api_key.py --list
```

## File Locations

- **API Key**: `keys/api_key_20250711_182612.txt` - Contains the actual key (keep secure!)
- **Hash File**: `keys/api_key_hash_20250711_182612.json` - Contains the hash for verification
- **ENV Template**: `.env.unified_parser` - Template for environment configuration

## Integration with Unified Parser

The unified parser service validates API keys by:
1. Extracting the key from the Authorization header
2. Comparing it with the configured `UNIFIED_PARSER_API_KEY` environment variable
3. Returning 401 Unauthorized if the key is invalid

Make sure the unified parser service has the same API key configured in its `.env` file.