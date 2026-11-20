import express from 'express';
const router = express.Router();
import QRCode from 'qrcode';
import { getSupabase } from '../config/services.config.js';

// Generate QR code for share link
router.get('/:shareId', async (req, res) => {
  try {
    const { shareId } = req.params;
    const { size = 'medium', format = 'png' } = req.query;
    
    // Verify share link exists
    const supabase = getSupabase();
    const { data: shareLink, error } = await supabase
      .from('shareable_links')
      .select('share_id, is_active')
      .eq('share_id', shareId)
      .single();
    
    if (error || !shareLink || !shareLink.is_active) {
      return res.status(404).json({
        error: { message: 'Share link not found or inactive' }
      });
    }
    
    // Determine QR code size
    const sizes = {
      small: 150,
      medium: 300,
      large: 500
    };
    const width = sizes[size] || sizes.medium;
    
    // Generate QR code URL
    const shareUrl = `https://getbrainlift.app/${shareId}`;
    
    // QR code options
    const qrOptions = {
      width,
      margin: 2,
      color: {
        dark: '#1F2937',  // Dark gray
        light: '#FFFFFF'  // White
      },
      errorCorrectionLevel: 'H'
    };
    
    if (format === 'svg') {
      // Generate SVG QR code
      const svgString = await QRCode.toString(shareUrl, {
        ...qrOptions,
        type: 'svg'
      });
      
      res.setHeader('Content-Type', 'image/svg+xml');
      res.send(svgString);
    } else {
      // Generate PNG QR code (default)
      const buffer = await QRCode.toBuffer(shareUrl, qrOptions);
      
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Length', buffer.length);
      res.send(buffer);
    }
  } catch (error) {
    console.error('[QR] Generation error:', error);
    res.status(500).json({
      error: { message: 'Failed to generate QR code' }
    });
  }
});

// Generate branded QR code with logo
router.get('/:shareId/branded', async (req, res) => {
  try {
    const { shareId } = req.params;
    const { size = 'medium' } = req.query;
    
    // Verify share link exists
    const supabase = getSupabase();
    const { data: shareLink, error } = await supabase
      .from('shareable_links')
      .select('share_id, is_active, title, content_type')
      .eq('share_id', shareId)
      .single();
    
    if (error || !shareLink || !shareLink.is_active) {
      return res.status(404).json({
        error: { message: 'Share link not found or inactive' }
      });
    }
    
    // Determine QR code size
    const sizes = {
      small: 200,
      medium: 400,
      large: 600
    };
    const width = sizes[size] || sizes.medium;
    
    // Generate QR code URL
    const shareUrl = `https://getbrainlift.app/${shareId}`;
    
    // Generate base QR code as data URL
    const qrDataUrl = await QRCode.toDataURL(shareUrl, {
      width,
      margin: 4,
      color: {
        dark: '#3B82F6',  // BrainLift blue
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'H'
    });
    
    // Create SVG with branding
    const svg = `
      <svg width="${width}" height="${width + 60}" xmlns="http://www.w3.org/2000/svg">
        <!-- Background -->
        <rect width="${width}" height="${width + 60}" fill="#FFFFFF" rx="20"/>
        
        <!-- QR Code -->
        <image x="0" y="0" width="${width}" height="${width}" href="${qrDataUrl}"/>
        
        <!-- Logo overlay (center of QR) -->
        <g transform="translate(${width/2}, ${width/2})">
          <circle r="40" fill="#FFFFFF"/>
          <circle r="35" fill="#3B82F6"/>
          <text x="0" y="5" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#FFFFFF">BL</text>
        </g>
        
        <!-- Bottom text -->
        <text x="${width/2}" y="${width + 25}" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="600" fill="#1F2937">
          ${shareLink.content_type === 'quiz' ? 'Quiz' : 'Flashcards'}
        </text>
        <text x="${width/2}" y="${width + 45}" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#6B7280">
          Scan to import
        </text>
      </svg>
    `;
    
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(svg);
  } catch (error) {
    console.error('[QR] Branded generation error:', error);
    res.status(500).json({
      error: { message: 'Failed to generate branded QR code' }
    });
  }
});

export default router;