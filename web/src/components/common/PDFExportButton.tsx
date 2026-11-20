import React, { useState } from 'react';
import { Download, Loader2, FileDown, Eye } from 'lucide-react';
import { pdfService } from '@/services/pdf.service';
import type { PDFExportOptions } from '@/services/pdf.service';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

interface PDFExportButtonProps {
  content: string | (() => Promise<string>);
  type: PDFExportOptions['type'];
  title?: string;
  metadata?: Record<string, unknown>;
  filename?: string;
  variant?: 'default' | 'ghost' | 'primary';
  size?: 'sm' | 'md' | 'lg';
  preview?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export const PDFExportButton: React.FC<PDFExportButtonProps> = ({
  content,
  type,
  title,
  metadata,
  filename = 'export.pdf',
  variant = 'default',
  size = 'md',
  preview = false,
  className,
  children,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  const handleExport = async (shouldPreview: boolean = false) => {
    setIsExporting(true);
    setShowOptions(false);

    try {
      // Get content if it's a function
      const exportContent = typeof content === 'function' ? await content() : content;

      // Generate PDF
      const blob = await pdfService.generatePDF({
        content: exportContent,
        type,
        title,
        metadata,
      });

      // Download or preview
      if (shouldPreview) {
        pdfService.previewPDF(blob);
        toast.success('PDF opened in new tab');
      } else {
        pdfService.downloadPDF(blob, filename);
        toast.success('PDF downloaded successfully');
      }
    } catch {
      console.error('PDF export error:');
      toast.error('Failed to export PDF');
    } finally {
      setIsExporting(false);
    }
  };

  const sizeClasses = {
    sm: 'px-2 py-1 text-sm',
    md: 'px-3 py-2',
    lg: 'px-4 py-3',
  };

  const variantClasses = {
    default: 'bg-pg-navy/10 hover:bg-pg-navy/20 border-2 border-pg-navy',
    ghost: 'hover:bg-pg-navy/10',
    primary: 'btn-gradient text-white border-2 border-pg-navy shadow-clay-coral hover:shadow-clay-coral-hover',
  };

  const buttonContent = children || (
    <>
      {isExporting ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Download className="w-4 h-4" />
      )}
      {size !== 'sm' && <span>{isExporting ? 'Exporting...' : 'Export PDF'}</span>}
    </>
  );

  if (preview) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowOptions(!showOptions)}
          disabled={isExporting}
          className={cn(
            'rounded-lg transition-all duration-200 flex items-center gap-2',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            sizeClasses[size],
            variantClasses[variant],
            className
          )}
        >
          {buttonContent}
        </button>

        {showOptions && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowOptions(false)}
            />
            <div className="absolute right-0 top-full mt-1 bg-pg-surface border-2 border-pg-navy rounded-lg shadow-clay-teal z-20 overflow-hidden">
              <button
                onClick={() => handleExport(false)}
                className="flex items-center gap-2 w-full px-4 py-2 hover:bg-pg-navy/10 transition-colors text-left whitespace-nowrap font-body text-pg-text"
              >
                <FileDown className="w-4 h-4" />
                Download PDF
              </button>
              <button
                onClick={() => handleExport(true)}
                className="flex items-center gap-2 w-full px-4 py-2 hover:bg-pg-navy/10 transition-colors text-left whitespace-nowrap font-body text-pg-text"
              >
                <Eye className="w-4 h-4" />
                Preview PDF
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => handleExport(false)}
      disabled={isExporting}
      className={cn(
        'rounded-lg transition-all duration-200 flex items-center gap-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
    >
      {buttonContent}
    </button>
  );
};
