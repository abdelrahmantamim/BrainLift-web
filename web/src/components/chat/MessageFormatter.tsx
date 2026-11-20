import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Modal, Box, IconButton } from '@mui/material';
import { Close as CloseIcon, ZoomIn, ZoomOut } from '@mui/icons-material';

interface ChartModalProps {
  open: boolean;
  onClose: () => void;
  imageUrl: string;
  title: string;
}

function ChartModal({ open, onClose, imageUrl, title }: ChartModalProps) {
  const [zoom, setZoom] = useState(1);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.2, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.2, 0.5));

  return (
    <Modal
      open={open}
      onClose={onClose}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Box
        sx={{
          position: 'relative',
          bgcolor: 'background.paper',
          borderRadius: 2,
          boxShadow: 24,
          p: 2,
          maxWidth: '90vw',
          maxHeight: '90vh',
          overflow: 'auto',
        }}
      >
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          mb: 2
        }}>
          <h3>{title}</h3>
          <Box>
            <IconButton onClick={handleZoomOut} disabled={zoom <= 0.5}>
              <ZoomOut />
            </IconButton>
            <IconButton onClick={handleZoomIn} disabled={zoom >= 3}>
              <ZoomIn />
            </IconButton>
            <IconButton onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'auto',
            maxHeight: 'calc(90vh - 100px)',
          }}
        >
          <img 
            src={imageUrl} 
            alt={title}
            style={{
              transform: `scale(${zoom})`,
              transition: 'transform 0.2s ease-in-out',
              maxWidth: '100%',
              height: 'auto',
            }}
          />
        </Box>
      </Box>
    </Modal>
  );
}

interface MessageFormatterProps {
  content: string;
  isAI?: boolean;
}

interface ChartSpec {
  type: string;
  title: string;
  data: Record<string, unknown>;
}

interface ChartInfo {
  spec: ChartSpec;
  startIndex: number;
  endIndex: number;
  thumbnail?: string;
  fullImage?: string;
}

export function MessageFormatter({ content, isAI = false }: MessageFormatterProps) {
  const [charts, setCharts] = useState<ChartInfo[]>([]);
  const [processedContent, setProcessedContent] = useState(content);
  const [selectedChart, setSelectedChart] = useState<ChartInfo | null>(null);

  // Extract and process charts (simplified without Convex renderChart)
  useEffect(() => {
    if (!isAI) {
      setProcessedContent(content);
      return;
    }

    const extractCharts = () => {
      const chartRegex = /```chart-json\s*\n([\s\S]*?)\n```/g;
      const foundCharts: ChartInfo[] = [];
      let match;

      while ((match = chartRegex.exec(content)) !== null) {
        try {
          const spec = JSON.parse(match[1]) as ChartSpec;
          foundCharts.push({
            spec,
            startIndex: match.index,
            endIndex: match.index + match[0].length,
          });
        } catch (e) {
          console.error("Failed to parse chart JSON:", e);
        }
      }

      if (foundCharts.length === 0) {
        setProcessedContent(content);
        return;
      }

      setCharts(foundCharts);

      // Replace chart JSON with placeholders in content
      let newContent = content;
      for (let i = foundCharts.length - 1; i >= 0; i--) {
        const chart = foundCharts[i];
        const replacement = `\n\n**Chart: ${chart.spec.title}** *(Chart rendering temporarily disabled)*\n\n`;
        newContent = 
          newContent.substring(0, chart.startIndex) +
          replacement +
          newContent.substring(chart.endIndex);
      }

      setProcessedContent(newContent);
    };

    extractCharts();
  }, [content, isAI]);

  const handleChartClick = (index: number) => {
    const chart = charts[index];
    if (chart && chart.fullImage) {
      setSelectedChart(chart);
    }
  };

  return (
    <>
      <ReactMarkdown
        components={{
          code(props: { inline?: boolean; className?: string; children?: React.ReactNode }) {
            const { inline, className, children, ...restProps } = props;
            const match = /language-(\w+)/.exec(className || '');
            return !inline && match ? (
              <SyntaxHighlighter
                style={tomorrow as {[key: string]: React.CSSProperties}}
                language={match[1]}
                PreTag="div"
                {...restProps}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            ) : (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          img({ src, alt }) {
            // Check if this is a chart placeholder
            const chartMatch = src?.match(/^chart-(\d+)$/);
            if (chartMatch) {
              const index = parseInt(chartMatch[1]);
              const chart = charts[index];
              if (chart && chart.thumbnail) {
                return (
                  <Box
                    component="div"
                    sx={{
                      display: 'inline-block',
                      cursor: 'pointer',
                      border: '1px solid #e0e0e0',
                      borderRadius: 1,
                      p: 1,
                      my: 2,
                      '&:hover': {
                        boxShadow: 2,
                      },
                    }}
                    onClick={() => handleChartClick(index)}
                  >
                    <img 
                      src={chart.thumbnail} 
                      alt={alt || chart.spec.title}
                      style={{
                        maxWidth: '100%',
                        height: 'auto',
                        display: 'block',
                      }}
                    />
                    <Box sx={{ 
                      textAlign: 'center', 
                      mt: 1, 
                      fontSize: '0.9em',
                      color: 'text.secondary'
                    }}>
                      Click to view full size
                    </Box>
                  </Box>
                );
              }
            }
            
            // Regular image
            return <img src={src} alt={alt} style={{ maxWidth: '100%' }} />;
          },
        }}
      >
        {processedContent}
      </ReactMarkdown>

      {selectedChart && (
        <ChartModal
          open={!!selectedChart}
          onClose={() => setSelectedChart(null)}
          imageUrl={selectedChart.fullImage!}
          title={selectedChart.spec.title}
        />
      )}
    </>
  );
}