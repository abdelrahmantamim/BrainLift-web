"""
Redis cache service for parsed documents
"""

from typing import Optional, Dict, Any
import json
import hashlib
import structlog
import redis.asyncio as redis

from ..config import settings

logger = structlog.get_logger()


class CacheService:
    """Redis caching for parsed documents"""
    
    def __init__(self):
        self.redis_client: Optional[redis.Redis] = None
        self._initialize_redis()
    
    def _initialize_redis(self):
        """Initialize Redis client"""
        if settings.redis_url:
            try:
                self.redis_client = redis.from_url(
                    settings.redis_url,
                    decode_responses=True
                )
                logger.info("redis_client_initialized")
            except Exception as e:
                logger.error("redis_initialization_failed", error=str(e))
                self.redis_client = None
        else:
            logger.debug("redis_not_configured")
    
    def _generate_cache_key(self, file_content_hash: str, options_hash: str) -> str:
        """Generate cache key from file and options"""
        return f"parsed_doc:{file_content_hash}:{options_hash}"
    
    def _hash_content(self, content: bytes) -> str:
        """Generate hash of file content"""
        return hashlib.sha256(content).hexdigest()
    
    def _hash_options(self, options: Dict[str, Any]) -> str:
        """Generate hash of parsing options"""
        options_str = json.dumps(options, sort_keys=True)
        return hashlib.md5(options_str.encode()).hexdigest()
    
    async def get_cached_document(
        self, 
        file_content: bytes,
        options: Dict[str, Any]
    ) -> Optional[Dict]:
        """Retrieve cached parsed document"""
        if not self.redis_client:
            return None
        
        try:
            content_hash = self._hash_content(file_content)
            options_hash = self._hash_options(options)
            cache_key = self._generate_cache_key(content_hash, options_hash)
            
            # Get from cache
            cached_data = await self.redis_client.get(cache_key)
            
            if cached_data:
                logger.info("cache_hit", key=cache_key)
                return json.loads(cached_data)
            else:
                logger.debug("cache_miss", key=cache_key)
                return None
                
        except Exception as e:
            logger.error("cache_get_failed", error=str(e))
            return None
    
    async def cache_document(
        self,
        file_content: bytes,
        options: Dict[str, Any],
        parsed_document: Dict,
        ttl: int = None
    ) -> bool:
        """Cache parsed document"""
        if not self.redis_client:
            return False
        
        try:
            content_hash = self._hash_content(file_content)
            options_hash = self._hash_options(options)
            cache_key = self._generate_cache_key(content_hash, options_hash)
            
            # Serialize document
            document_json = json.dumps(parsed_document)
            
            # Set in cache with TTL
            ttl = ttl or settings.cache_ttl
            await self.redis_client.setex(
                cache_key,
                ttl,
                document_json
            )
            
            logger.info("document_cached", key=cache_key, ttl=ttl)
            return True
            
        except Exception as e:
            logger.error("cache_set_failed", error=str(e))
            return False
    
    async def invalidate_cache(self, pattern: str = None) -> int:
        """Invalidate cached documents"""
        if not self.redis_client:
            return 0
        
        try:
            if pattern:
                # Delete keys matching pattern
                keys = []
                async for key in self.redis_client.scan_iter(match=f"parsed_doc:*{pattern}*"):
                    keys.append(key)
                
                if keys:
                    deleted = await self.redis_client.delete(*keys)
                    logger.info("cache_invalidated", pattern=pattern, count=deleted)
                    return deleted
            else:
                # Clear all parsed document cache
                keys = []
                async for key in self.redis_client.scan_iter(match="parsed_doc:*"):
                    keys.append(key)
                
                if keys:
                    deleted = await self.redis_client.delete(*keys)
                    logger.info("cache_cleared", count=deleted)
                    return deleted
            
            return 0
            
        except Exception as e:
            logger.error("cache_invalidation_failed", error=str(e))
            return 0
    
    async def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        if not self.redis_client:
            return {"available": False}
        
        try:
            # Count cached documents
            count = 0
            total_size = 0
            
            async for key in self.redis_client.scan_iter(match="parsed_doc:*"):
                count += 1
                # Get size of cached item
                value = await self.redis_client.get(key)
                if value:
                    total_size += len(value)
            
            # Get Redis info
            info = await self.redis_client.info()
            
            return {
                "available": True,
                "cached_documents": count,
                "total_size_bytes": total_size,
                "total_size_mb": round(total_size / 1024 / 1024, 2),
                "redis_memory_used": info.get("used_memory_human", "unknown"),
                "redis_connected_clients": info.get("connected_clients", 0)
            }
            
        except Exception as e:
            logger.error("cache_stats_failed", error=str(e))
            return {"available": False, "error": str(e)}
    
    async def close(self):
        """Close Redis connection"""
        if self.redis_client:
            await self.redis_client.close()
            logger.info("redis_connection_closed")