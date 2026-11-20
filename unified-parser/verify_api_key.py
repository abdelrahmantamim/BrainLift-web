#!/usr/bin/env python3
"""
API Key Verification Utility for Unified Parser Service

This utility helps verify API keys against stored hashes.
"""

import hashlib
import json
import argparse
from pathlib import Path
from datetime import datetime


def hash_api_key(api_key: str) -> str:
    """Create a SHA-256 hash of the API key."""
    return hashlib.sha256(api_key.encode()).hexdigest()


def verify_api_key(api_key: str) -> bool:
    """
    Verify an API key against stored hashes.
    
    Args:
        api_key: The API key to verify
    
    Returns:
        True if the key is valid, False otherwise
    """
    key_hash = hash_api_key(api_key)
    keys_dir = Path("keys")
    
    if not keys_dir.exists():
        print("❌ No keys directory found. No keys have been generated yet.")
        return False
    
    # Check all hash files
    hash_files = list(keys_dir.glob("api_key_hash_*.json"))
    
    for hash_file in hash_files:
        try:
            with open(hash_file, 'r') as f:
                data = json.load(f)
                if data['hash'] == key_hash:
                    print(f"✅ Valid API key!")
                    print(f"   Created: {data['created_at']}")
                    if data.get('description'):
                        print(f"   Description: {data['description']}")
                    return True
        except Exception as e:
            print(f"⚠️  Error reading {hash_file}: {e}")
    
    print("❌ Invalid API key. The key was not found in the stored hashes.")
    return False


def list_api_keys():
    """List all generated API keys (showing only partial keys for security)."""
    keys_dir = Path("keys")
    
    if not keys_dir.exists():
        print("No keys have been generated yet.")
        return
    
    hash_files = sorted(keys_dir.glob("api_key_hash_*.json"))
    
    if not hash_files:
        print("No API key hashes found.")
        return
    
    print("📋 Generated API Keys:")
    print("=" * 60)
    
    for i, hash_file in enumerate(hash_files, 1):
        try:
            with open(hash_file, 'r') as f:
                data = json.load(f)
                print(f"\n{i}. {data.get('key_prefix', 'Unknown')}")
                print(f"   Created: {data['created_at']}")
                if data.get('description'):
                    print(f"   Description: {data['description']}")
                print(f"   Hash: {data['hash'][:16]}...")
        except Exception as e:
            print(f"\n{i}. Error reading file: {e}")


def main():
    parser = argparse.ArgumentParser(
        description="Verify API keys for the Unified Parser Service"
    )
    parser.add_argument(
        "api_key",
        nargs='?',
        help="The API key to verify"
    )
    parser.add_argument(
        "-l", "--list",
        action="store_true",
        help="List all generated API keys (partial view)"
    )
    
    args = parser.parse_args()
    
    print("🔍 Unified Parser API Key Verifier")
    print("=" * 50)
    
    if args.list:
        list_api_keys()
    elif args.api_key:
        verify_api_key(args.api_key)
    else:
        # Interactive mode
        api_key = input("\nEnter API key to verify: ").strip()
        if api_key:
            verify_api_key(api_key)
        else:
            print("❌ No API key provided.")


if __name__ == "__main__":
    main()