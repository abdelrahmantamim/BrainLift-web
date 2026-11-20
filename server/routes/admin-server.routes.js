import express from 'express';
import { requireAdminAuth } from '../middleware/adminAuth.middleware.js';
import { getSupabase } from '../config/services.config.js';
import os from 'os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs/promises';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// Get server info
router.get('/info', requireAdminAuth, async (req, res) => {
  try {
    const supabase = getSupabase();
    
    // Get database stats and model assignments
    const [
      { count: totalUsers },
      { count: totalFiles },
      { count: totalQuizzes },
      { count: totalFlashcards },
      { data: modelAssignments }
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('files').select('*', { count: 'exact', head: true }),
      supabase.from('quizzes').select('*', { count: 'exact', head: true }),
      supabase.from('flashcard_sets').select('*', { count: 'exact', head: true }),
      supabase.from('model_assignments').select('*, ai_models(*)')
    ]);
    
    // Get server uptime and memory usage
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    // Get disk usage (approximate)
    let diskUsage = { used: 0, total: 0 };
    try {
      const uploadsDir = path.join(dirname(dirname(__dirname)), 'uploads');
      
      // Check if directory exists first
      try {
        await fs.access(uploadsDir);
        const files = await fs.readdir(uploadsDir, { recursive: true });
        for (const file of files) {
          try {
            const stat = await fs.stat(path.join(uploadsDir, file));
            if (stat.isFile()) {
              diskUsage.used += stat.size;
            }
          } catch (err) {
            // Ignore individual file errors
          }
        }
      } catch (err) {
        // Directory doesn't exist, that's okay
        console.log('[Admin Server] Uploads directory not found, skipping disk usage calculation');
      }
    } catch (err) {
      console.error('[Admin Server] Error calculating disk usage:', err);
    }
    
    // Format active models
    const activeModels = {
      chat: 'Not configured',
      files: 'Not configured', 
      testing: 'Not configured'
    };
    
    if (modelAssignments) {
      modelAssignments.forEach(assignment => {
        if (assignment.ai_models && assignment.is_active) {
          // Map 'testing' feature (also handles legacy 'quiz' in DB)
          const feature = assignment.feature === 'quiz' ? 'testing' : assignment.feature;
          activeModels[feature] = assignment.ai_models.display_name || assignment.ai_models.model_name || 'Unknown Model';
        }
      });
    }
    
    res.json({
      server: {
        uptime: Math.floor(uptime),
        uptimeFormatted: formatUptime(uptime),
        nodeVersion: process.version,
        platform: os.platform(),
        arch: os.arch(),
        hostname: os.hostname()
      },
      memory: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external,
        rssFormatted: formatBytes(memoryUsage.rss),
        heapTotalFormatted: formatBytes(memoryUsage.heapTotal),
        heapUsedFormatted: formatBytes(memoryUsage.heapUsed),
        externalFormatted: formatBytes(memoryUsage.external)
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
        userFormatted: (cpuUsage.user / 1000000).toFixed(2) + 's',
        systemFormatted: (cpuUsage.system / 1000000).toFixed(2) + 's'
      },
      database: {
        totalUsers: totalUsers || 0,
        totalFiles: totalFiles || 0,
        totalQuizzes: totalQuizzes || 0,
        totalFlashcards: totalFlashcards || 0
      },
      storage: {
        uploads: {
          used: diskUsage.used,
          usedFormatted: formatBytes(diskUsage.used)
        }
      },
      environment: {
        nodeEnv: process.env.NODE_ENV || 'development',
        port: process.env.PORT || 3001
      },
      activeModels
    });
  } catch (error) {
    console.error('[Admin Server] Error fetching server info:', error);
    res.status(500).json({
      error: { message: 'Failed to fetch server information' }
    });
  }
});

// Get server logs
router.get('/logs', requireAdminAuth, async (req, res) => {
  try {
    const { lines = 100, level = 'all' } = req.query;
    const logPath = path.join(dirname(dirname(__dirname)), 'logs', 'server-logs.log');
    
    try {
      const logContent = await fs.readFile(logPath, 'utf-8');
      const logLines = logContent.split('\n').filter(line => line.trim());
      
      // Filter by level if specified
      let filteredLines = logLines;
      if (level !== 'all') {
        filteredLines = logLines.filter(line => 
          line.toLowerCase().includes(`[${level.toLowerCase()}]`)
        );
      }
      
      // Get last N lines
      const result = filteredLines.slice(-parseInt(lines));
      
      res.json({
        logs: result,
        totalLines: result.length,
        logFile: 'server-logs.log'
      });
    } catch (err) {
      res.json({
        logs: [],
        totalLines: 0,
        error: 'Log file not found or not readable'
      });
    }
  } catch (error) {
    console.error('[Admin Server] Error fetching logs:', error);
    res.status(500).json({
      error: { message: 'Failed to fetch server logs' }
    });
  }
});

// Helper functions
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
  
  return parts.join(' ');
}

export default router;