"""
Database service for storing parsed documents and chunks
"""

from typing import List, Dict, Any, Optional
import asyncio
import json
from datetime import datetime
import structlog
from supabase import create_client, Client

from ..config import settings
from ..models import ParsedDocument, Chunk

logger = structlog.get_logger()


class DatabaseService:
    """Service for storing parsed documents in Supabase"""
    
    def __init__(self):
        self.client: Optional[Client] = None
        self._initialize_client()
    
    def _initialize_client(self):
        """Initialize Supabase client"""
        # Use service key for server-side operations
        if settings.supabase_url and settings.supabase_service_key:
            try:
                self.client = create_client(
                    settings.supabase_url,
                    settings.supabase_service_key
                )
                logger.info("supabase_client_initialized", using_key="service_key")
            except Exception as e:
                logger.error("supabase_initialization_failed", error=str(e))
                self.client = None
        else:
            logger.warning("supabase_credentials_not_configured")
    
    async def store_document(
        self, 
        document: ParsedDocument,
        user_id: str,
        file_name: str,
        file_type: str,
        processing_id: str
    ) -> Optional[str]:
        """Store parsed document and chunks"""
        if not self.client:
            logger.error("database_client_not_initialized")
            return None
        
        try:
            # Prepare document data
            doc_data = {
                "user_id": user_id,
                "file_name": file_name,
                "file_type": file_type,
                "processing_id": processing_id,
                "title": document.metadata.title,
                "author": document.metadata.author,
                "pages": document.metadata.pages,
                "word_count": document.metadata.word_count,
                "language": document.metadata.language,
                "has_tables": document.metadata.has_tables,
                "has_images": document.metadata.has_images,
                "created_date": document.metadata.created_date,
                "modified_date": document.metadata.modified_date,
                "chunk_count": len(document.chunks),
                "processed_at": datetime.utcnow().isoformat(),
                "metadata": json.dumps(document.metadata.dict())
            }
            
            # Insert document
            doc_result = await self._insert_document(doc_data)
            if not doc_result:
                return None
            
            document_id = doc_result["id"]
            
            # Store chunks
            chunk_results = await self._store_chunks(
                document_id,
                document.chunks,
                user_id
            )
            
            logger.info(
                "document_stored",
                document_id=document_id,
                chunks_stored=len(chunk_results)
            )
            
            return document_id
            
        except Exception as e:
            logger.error("document_storage_failed", error=str(e))
            return None
    
    async def _insert_document(self, doc_data: Dict) -> Optional[Dict]:
        """Insert document record"""
        try:
            result = self.client.table("parsed_documents").insert(doc_data).execute()
            return result.data[0] if result.data else None
        except Exception as e:
            logger.error("document_insert_failed", error=str(e))
            return None
    
    async def _store_chunks(
        self, 
        document_id: str,
        chunks: List[Chunk],
        user_id: str
    ) -> List[Dict]:
        """Store document chunks"""
        stored_chunks = []
        
        # Prepare chunk data
        chunk_data = []
        for idx, chunk in enumerate(chunks):
            chunk_dict = {
                "document_id": document_id,
                "user_id": user_id,
                "chunk_index": idx,
                "chunk_type": chunk.type,
                "content": self._serialize_content(chunk.content),
                "parent_id": chunk.parent_id,
                "level": chunk.level,
                "metadata": json.dumps({
                    "page": chunk.metadata.page,
                    "section": chunk.metadata.section,
                    "has_table": chunk.metadata.has_table,
                    "has_image": chunk.metadata.has_image,
                    "language": chunk.metadata.language,
                    "confidence": chunk.metadata.confidence,
                    **chunk.metadata.dict()
                })
            }
            chunk_data.append(chunk_dict)
        
        # Insert chunks in batches
        batch_size = 100
        for i in range(0, len(chunk_data), batch_size):
            batch = chunk_data[i:i + batch_size]
            try:
                result = self.client.table("document_chunks").insert(batch).execute()
                if result.data:
                    stored_chunks.extend(result.data)
            except Exception as e:
                logger.error(
                    "chunk_batch_insert_failed",
                    batch_start=i,
                    batch_size=len(batch),
                    error=str(e)
                )
        
        return stored_chunks
    
    def _serialize_content(self, content: Any) -> str:
        """Serialize chunk content to string"""
        if isinstance(content, str):
            return content
        elif isinstance(content, (dict, list)):
            return json.dumps(content)
        else:
            return str(content)
    
    async def get_document(self, document_id: str) -> Optional[Dict]:
        """Retrieve document by ID"""
        if not self.client:
            return None
        
        try:
            result = self.client.table("parsed_documents")\
                .select("*")\
                .eq("id", document_id)\
                .execute()
            
            return result.data[0] if result.data else None
            
        except Exception as e:
            logger.error("document_retrieval_failed", error=str(e))
            return None
    
    async def get_document_chunks(
        self, 
        document_id: str,
        chunk_types: Optional[List[str]] = None
    ) -> List[Dict]:
        """Retrieve chunks for a document"""
        if not self.client:
            return []
        
        try:
            query = self.client.table("document_chunks")\
                .select("*")\
                .eq("document_id", document_id)\
                .order("chunk_index")
            
            if chunk_types:
                query = query.in_("chunk_type", chunk_types)
            
            result = query.execute()
            return result.data if result.data else []
            
        except Exception as e:
            logger.error("chunks_retrieval_failed", error=str(e))
            return []
    
    async def search_chunks(
        self,
        user_id: str,
        query: str,
        limit: int = 10,
        chunk_types: Optional[List[str]] = None
    ) -> List[Dict]:
        """Search chunks by content"""
        if not self.client:
            return []
        
        try:
            search_query = self.client.table("document_chunks")\
                .select("*, parsed_documents!inner(*)")\
                .eq("user_id", user_id)\
                .ilike("content", f"%{query}%")\
                .limit(limit)
            
            if chunk_types:
                search_query = search_query.in_("chunk_type", chunk_types)
            
            result = search_query.execute()
            return result.data if result.data else []
            
        except Exception as e:
            logger.error("chunk_search_failed", error=str(e))
            return []
    
    async def get_user_documents(
        self,
        user_id: str,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict]:
        """Get documents for a user"""
        if not self.client:
            return []
        
        try:
            result = self.client.table("parsed_documents")\
                .select("*")\
                .eq("user_id", user_id)\
                .order("processed_at", desc=True)\
                .range(offset, offset + limit - 1)\
                .execute()
            
            return result.data if result.data else []
            
        except Exception as e:
            logger.error("user_documents_retrieval_failed", error=str(e))
            return []
    
    async def delete_document(self, document_id: str, user_id: str) -> bool:
        """Delete document and its chunks"""
        if not self.client:
            return False
        
        try:
            # Delete chunks first
            self.client.table("document_chunks")\
                .delete()\
                .eq("document_id", document_id)\
                .eq("user_id", user_id)\
                .execute()
            
            # Delete document
            self.client.table("parsed_documents")\
                .delete()\
                .eq("id", document_id)\
                .eq("user_id", user_id)\
                .execute()
            
            logger.info("document_deleted", document_id=document_id)
            return True
            
        except Exception as e:
            logger.error("document_deletion_failed", error=str(e))
            return False