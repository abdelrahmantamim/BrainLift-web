#!/usr/bin/env python3
"""
API Key Generator for Unified Parser Service

This utility generates secure API keys that can be used with the unified parser service.
The keys are cryptographically secure and follow best practices for API key generation.
"""

import secrets
import string
import argparse
import json
import hashlib
from datetime import datetime
from pathlib import Path


def generate_api_key(length: int = 32, prefix: str = "up_") -> str:
    """
    Generate a secure API key.
    
    Args:
        length: Length of the random part of the key (default: 32)
        prefix: Prefix for the key (default: "up_" for unified parser)
    
    Returns:
        A secure API key string
    """
    # Use URL-safe characters for the key
    alphabet = string.ascii_letters + string.digits + "-_"
    random_part = ''.join(secrets.choice(alphabet) for _ in range(length))
    return f"{prefix}{random_part}"


def hash_api_key(api_key: str) -> str:
    """
    Create a SHA-256 hash of the API key for secure storage.
    
    Args:
        api_key: The API key to hash
    
    Returns:
        SHA-256 hash of the API key
    """
    return hashlib.sha256(api_key.encode()).hexdigest()


def save_api_key(api_key: str, description: str = "", save_hash: bool = True):
    """
    Save the API key to a secure location.
    
    Args:
        api_key: The generated API key
        description: Optional description for the key
        save_hash: Whether to save the hash for verification
    """
    # Create a keys directory if it doesn't exist
    keys_dir = Path("keys")
    keys_dir.mkdir(exist_ok=True)
    
    # Generate filename with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    # Save the actual key (should be given to the user securely)
    key_file = keys_dir / f"api_key_{timestamp}.txt"
    with open(key_file, 'w') as f:
        f.write(f"API Key: {api_key}\n")
        f.write(f"Generated: {datetime.now().isoformat()}\n")
        if description:
            f.write(f"Description: {description}\n")
        f.write("\n")
        f.write("IMPORTANT: Keep this key secure and do not share it publicly.\n")
        f.write("Add this to your server's .env file as:\n")
        f.write(f"UNIFIED_PARSER_API_KEY={api_key}\n")
    
    # Save the hash for verification (this is what the service stores)
    if save_hash:
        hash_file = keys_dir / f"api_key_hash_{timestamp}.json"
        hash_data = {
            "hash": hash_api_key(api_key),
            "created_at": datetime.now().isoformat(),
            "description": description,
            "key_prefix": api_key[:10] + "..."  # Store partial key for identification
        }
        with open(hash_file, 'w') as f:
            json.dump(hash_data, f, indent=2)
    
    return key_file, hash_file if save_hash else None


def generate_env_template(api_key: str):
    """
    Generate a template for the .env file.
    """
    template = f"""# Unified Parser API Configuration
UNIFIED_PARSER_API_KEY={api_key}
UNIFIED_PARSER_URL=http://localhost:8002

# Optional: Multiple API keys (comma-separated)
# UNIFIED_PARSER_API_KEYS={api_key},another_key_here

# Optional: Rate limiting
# UNIFIED_PARSER_RATE_LIMIT=100  # requests per minute
"""
    
    env_file = Path(".env.unified_parser")
    with open(env_file, 'w') as f:
        f.write(template)
    
    return env_file


def main():
    parser = argparse.ArgumentParser(
        description="Generate secure API keys for the Unified Parser Service"
    )
    parser.add_argument(
        "-l", "--length",
        type=int,
        default=32,
        help="Length of the random part of the key (default: 32)"
    )
    parser.add_argument(
        "-p", "--prefix",
        default="up_",
        help="Prefix for the API key (default: up_)"
    )
    parser.add_argument(
        "-d", "--description",
        default="",
        help="Description for this API key"
    )
    parser.add_argument(
        "-n", "--no-save",
        action="store_true",
        help="Don't save the key to files, just print it"
    )
    parser.add_argument(
        "--env",
        action="store_true",
        help="Generate a .env template file"
    )
    parser.add_argument(
        "-c", "--count",
        type=int,
        default=1,
        help="Number of API keys to generate (default: 1)"
    )
    
    args = parser.parse_args()
    
    print("🔐 Unified Parser API Key Generator")
    print("=" * 50)
    
    generated_keys = []
    
    for i in range(args.count):
        # Generate the API key
        api_key = generate_api_key(length=args.length, prefix=args.prefix)
        generated_keys.append(api_key)
        
        if args.count > 1:
            print(f"\nKey {i + 1}:")
        
        print(f"\n📌 Generated API Key:\n{api_key}")
        
        # Generate hash for reference
        key_hash = hash_api_key(api_key)
        print(f"\n🔒 SHA-256 Hash (for verification):\n{key_hash}")
        
        # Save to files unless --no-save is specified
        if not args.no_save:
            key_file, hash_file = save_api_key(
                api_key, 
                description=args.description if args.count == 1 else f"{args.description} (Key {i + 1})"
            )
            print(f"\n💾 Saved to:")
            print(f"   Key file: {key_file}")
            if hash_file:
                print(f"   Hash file: {hash_file}")
    
    # Generate .env template if requested
    if args.env and not args.no_save:
        # Use all keys if multiple were generated
        if len(generated_keys) > 1:
            env_key = ",".join(generated_keys)
        else:
            env_key = generated_keys[0]
        
        env_file = generate_env_template(env_key)
        print(f"\n📄 Generated .env template: {env_file}")
    
    print("\n" + "=" * 50)
    print("✅ API key(s) generated successfully!")
    
    if not args.no_save:
        print("\n⚠️  IMPORTANT SECURITY NOTES:")
        print("1. The generated key files contain sensitive information")
        print("2. Share the API key securely with authorized users only")
        print("3. Never commit API keys to version control")
        print("4. Add 'keys/' to your .gitignore file")
        print("5. Consider using environment variables in production")
    
    print("\n🚀 To use the API key:")
    print("1. Add it to your server's .env file:")
    print(f"   UNIFIED_PARSER_API_KEY={generated_keys[0]}")
    print("2. Or pass it in the Authorization header:")
    print("   Authorization: Bearer <your-api-key>")


if __name__ == "__main__":
    main()