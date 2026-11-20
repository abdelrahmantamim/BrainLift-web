"""
Structural chunker that preserves document hierarchy
"""

from typing import List, Dict, Any, Optional
import structlog

from .base import BaseChunker

logger = structlog.get_logger()


class StructuralChunker(BaseChunker):
    """
    Structural chunking that preserves document hierarchy
    - Maintains parent-child relationships
    - Groups related content by structure
    - Preserves semantic boundaries
    """
    
    async def process(
        self, 
        chunks: List[Dict[str, Any]], 
        max_size: int = 1000,
        language: str = "en",
        **kwargs
    ) -> List[Dict[str, Any]]:
        """Process chunks while preserving structure"""
        
        # Build hierarchy
        hierarchy = self._build_hierarchy(chunks)
        
        # Process each section
        processed_chunks = []
        for section in hierarchy:
            section_chunks = await self._process_section(section, max_size)
            processed_chunks.extend(section_chunks)
        
        return processed_chunks
    
    def _build_hierarchy(self, chunks: List[Dict[str, Any]]) -> List[Dict]:
        """Build document hierarchy from flat chunks"""
        sections = []
        current_section = None
        
        for chunk in chunks:
            chunk_type = chunk.get("type", "")
            
            if chunk_type == "heading":
                # Start new section
                level = chunk.get("level", 1)
                
                # Find appropriate parent section
                if current_section and level > current_section["level"]:
                    # Subsection of current
                    subsection = {
                        "heading": chunk,
                        "level": level,
                        "children": [],
                        "content": []
                    }
                    current_section["children"].append(subsection)
                    current_section = subsection
                else:
                    # New top-level or sibling section
                    while (current_section and 
                           current_section.get("parent") and 
                           current_section["level"] >= level):
                        current_section = current_section["parent"]
                    
                    new_section = {
                        "heading": chunk,
                        "level": level,
                        "children": [],
                        "content": [],
                        "parent": current_section
                    }
                    
                    if current_section:
                        current_section["children"].append(new_section)
                    else:
                        sections.append(new_section)
                    
                    current_section = new_section
            else:
                # Add content to current section
                if current_section:
                    current_section["content"].append(chunk)
                else:
                    # Content before any heading
                    if not sections or sections[-1].get("heading"):
                        # Create implicit section
                        sections.append({
                            "heading": None,
                            "level": 0,
                            "children": [],
                            "content": [chunk]
                        })
                    else:
                        sections[-1]["content"].append(chunk)
        
        return sections
    
    async def _process_section(
        self, 
        section: Dict, 
        max_size: int
    ) -> List[Dict[str, Any]]:
        """Process a section and its children"""
        processed = []
        
        # Add heading if exists
        if section.get("heading"):
            processed.append(section["heading"])
        
        # Process content chunks
        content_chunks = section.get("content", [])
        if content_chunks:
            # Group related content
            grouped = self._group_related_content(content_chunks, max_size)
            
            # Link to section heading
            if section.get("heading"):
                for chunk in grouped:
                    if "parent_id" not in chunk or not chunk["parent_id"]:
                        chunk["parent_id"] = section["heading"].get("id")
            
            processed.extend(grouped)
        
        # Process child sections
        for child in section.get("children", []):
            child_chunks = await self._process_section(child, max_size)
            processed.extend(child_chunks)
        
        return processed
    
    def _group_related_content(
        self, 
        chunks: List[Dict[str, Any]], 
        max_size: int
    ) -> List[Dict[str, Any]]:
        """Group related content chunks"""
        grouped = []
        current_group = None
        
        for chunk in chunks:
            chunk_type = chunk.get("type", "")
            
            # Special chunks stay separate
            if chunk_type in ["table", "image", "code", "list"]:
                if current_group:
                    grouped.append(self._finalize_group(current_group))
                    current_group = None
                grouped.append(chunk)
                continue
            
            # Text content can be grouped
            if chunk_type in ["paragraph", "text", "quote"]:
                content = chunk.get("content", "")
                
                if not isinstance(content, str):
                    # Non-string content, keep separate
                    if current_group:
                        grouped.append(self._finalize_group(current_group))
                        current_group = None
                    grouped.append(chunk)
                    continue
                
                # Check if we can add to current group
                if current_group:
                    combined_length = len(current_group["content"]) + len(content) + 2
                    if combined_length <= max_size:
                        # Add to group
                        current_group["content"] += "\n\n" + content
                        current_group["chunks"].append(chunk)
                    else:
                        # Start new group
                        grouped.append(self._finalize_group(current_group))
                        current_group = {
                            "type": "grouped_text",
                            "content": content,
                            "chunks": [chunk],
                            "metadata": chunk.get("metadata", {})
                        }
                else:
                    # Start first group
                    current_group = {
                        "type": "grouped_text",
                        "content": content,
                        "chunks": [chunk],
                        "metadata": chunk.get("metadata", {})
                    }
            else:
                # Unknown type, keep separate
                if current_group:
                    grouped.append(self._finalize_group(current_group))
                    current_group = None
                grouped.append(chunk)
        
        # Don't forget last group
        if current_group:
            grouped.append(self._finalize_group(current_group))
        
        return grouped
    
    def _finalize_group(self, group: Dict) -> Dict[str, Any]:
        """Finalize a grouped chunk"""
        if len(group["chunks"]) == 1:
            # Single chunk, return as-is
            return group["chunks"][0]
        
        # Multiple chunks grouped
        return {
            "type": "text",
            "content": group["content"],
            "metadata": {
                **group["metadata"],
                "grouped_chunks": len(group["chunks"]),
                "original_types": [c.get("type") for c in group["chunks"]]
            }
        }
    
    async def generate_summary(
        self,
        chunks: List[Dict[str, Any]],
        max_length: int = 500,
        style: str = "hierarchical"
    ) -> Dict[str, Any]:
        """Generate hierarchical summary"""
        # Build hierarchy first
        hierarchy = self._build_hierarchy(chunks)
        
        # Extract outline
        outline = self._extract_outline(hierarchy)
        
        # Extract key content
        key_content = self._extract_key_content(hierarchy, max_length)
        
        # Count statistics
        stats = self._calculate_stats(hierarchy)
        
        return {
            "summary": key_content,
            "outline": outline,
            "structure": {
                "sections": stats["sections"],
                "max_depth": stats["max_depth"],
                "content_distribution": stats["distribution"]
            },
            "key_topics": self._extract_topics_from_headings(hierarchy),
            "word_count": len(key_content.split())
        }
    
    def _extract_outline(self, sections: List[Dict], level: int = 0) -> List[Dict]:
        """Extract document outline"""
        outline = []
        
        for section in sections:
            if section.get("heading"):
                heading = section["heading"]
                outline_item = {
                    "text": heading.get("content", ""),
                    "level": heading.get("level", level),
                    "children": []
                }
                
                # Add child sections
                if section.get("children"):
                    outline_item["children"] = self._extract_outline(
                        section["children"], 
                        level + 1
                    )
                
                outline.append(outline_item)
        
        return outline
    
    def _extract_key_content(self, sections: List[Dict], max_length: int) -> str:
        """Extract key content from sections"""
        key_parts = []
        remaining_length = max_length
        
        # Prioritize section headings and first paragraphs
        for section in sections:
            if remaining_length <= 0:
                break
            
            # Add heading
            if section.get("heading"):
                heading_text = section["heading"].get("content", "")
                if heading_text:
                    key_parts.append(f"## {heading_text}")
                    remaining_length -= len(heading_text) + 3
            
            # Add first paragraph of content
            for chunk in section.get("content", [])[:2]:  # First 2 chunks
                if remaining_length <= 0:
                    break
                
                if chunk.get("type") in ["paragraph", "text"]:
                    content = chunk.get("content", "")
                    if isinstance(content, str):
                        # Truncate if needed
                        if len(content) > remaining_length:
                            content = content[:remaining_length] + "..."
                        key_parts.append(content)
                        remaining_length -= len(content)
                        break  # One paragraph per section
            
            # Process child sections (recursively)
            if section.get("children") and remaining_length > 0:
                child_content = self._extract_key_content(
                    section["children"][:2],  # First 2 subsections
                    remaining_length // 2  # Share remaining space
                )
                if child_content:
                    key_parts.append(child_content)
                    remaining_length -= len(child_content)
        
        return "\n\n".join(key_parts)
    
    def _calculate_stats(self, sections: List[Dict]) -> Dict:
        """Calculate structural statistics"""
        stats = {
            "sections": 0,
            "max_depth": 0,
            "distribution": {}
        }
        
        def count_sections(sections, depth=1):
            for section in sections:
                stats["sections"] += 1
                stats["max_depth"] = max(stats["max_depth"], depth)
                
                # Count content types
                for chunk in section.get("content", []):
                    chunk_type = chunk.get("type", "unknown")
                    stats["distribution"][chunk_type] = stats["distribution"].get(chunk_type, 0) + 1
                
                # Recurse
                if section.get("children"):
                    count_sections(section["children"], depth + 1)
        
        count_sections(sections)
        return stats
    
    def _extract_topics_from_headings(self, sections: List[Dict]) -> List[str]:
        """Extract main topics from section headings"""
        topics = []
        
        def extract_from_sections(sections, parent_topic=""):
            for section in sections:
                if section.get("heading"):
                    heading_text = section["heading"].get("content", "")
                    if heading_text:
                        # For top-level, use as-is
                        if section["level"] <= 2:
                            topics.append(heading_text)
                        # For deeper levels, combine with parent
                        elif parent_topic:
                            topics.append(f"{parent_topic}: {heading_text}")
                    
                    # Recurse with current heading as parent
                    if section.get("children"):
                        extract_from_sections(
                            section["children"], 
                            heading_text or parent_topic
                        )
        
        extract_from_sections(sections)
        
        # Return unique topics, limited to top 10
        unique_topics = []
        seen = set()
        for topic in topics:
            topic_lower = topic.lower()
            if topic_lower not in seen:
                seen.add(topic_lower)
                unique_topics.append(topic)
        
        return unique_topics[:10]