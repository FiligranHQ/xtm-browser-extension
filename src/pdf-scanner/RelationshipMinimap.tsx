/**
 * Relationship Mini-Map for PDF Viewer
 * 
 * React component that displays a small graph visualization in the bottom-left corner
 * showing entities and their relationships. Clicking opens a larger dialog view.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Chip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import { getIconPath, getEntityColor } from '../shared/visualization/entity-icons';
import { calculateLayout } from '../shared/visualization/graph-layout';
import type { GraphNode, GraphEdge, RelationshipData, EntityData } from '../shared/visualization/graph-types';
import { 
  MINIMAP_STYLES, 
  DIALOG_STYLES, 
  GRAPH_NODE_STYLES,
  getGraphNodeStyle,
} from '../shared/visualization/relationship-styles';

// ============================================================================
// Components
// ============================================================================

interface GraphVisualizationProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  width: number;
  height: number;
  isExpanded: boolean;
}

const GraphVisualization: React.FC<GraphVisualizationProps> = ({
  nodes,
  edges,
  width,
  height,
  isExpanded,
}) => {
  // Use shared constants for consistent styling between web and PDF
  const style = getGraphNodeStyle(isExpanded);
  const { nodeRadius, fontSize, labelOffset, maxLabelLength, truncateLength, strokeWidth, edgeStrokeWidth } = style;

  const layoutNodes = useMemo(
    () => calculateLayout(nodes, edges, width, height),
    [nodes, edges, width, height]
  );

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <marker
          id={`arrow-${isExpanded ? 'lg' : 'sm'}`}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="4"
          markerHeight="4"
          orient="auto-start-reverse"
        >
          <polygon points="0 0, 10 5, 0 10" fill="#666" />
        </marker>
        <filter id="node-shadow">
          <feDropShadow dx="1" dy="1" stdDeviation="2" floodOpacity="0.3" />
        </filter>
      </defs>

      {/* Edges */}
      {edges.map((edge, i) => {
        const fromNode = layoutNodes.find(n => n.value.toLowerCase() === edge.from.toLowerCase());
        const toNode = layoutNodes.find(n => n.value.toLowerCase() === edge.to.toLowerCase());
        if (!fromNode || !toNode) return null;

        const dx = toNode.x - fromNode.x;
        const dy = toNode.y - fromNode.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const offsetRatio = nodeRadius / dist;

        const x1 = fromNode.x + dx * offsetRatio;
        const y1 = fromNode.y + dy * offsetRatio;
        const x2 = toNode.x - dx * offsetRatio;
        const y2 = toNode.y - dy * offsetRatio;

        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        const perpX = (-dy / dist) * GRAPH_NODE_STYLES.edgeCurveOffset;
        const perpY = (dx / dist) * GRAPH_NODE_STYLES.edgeCurveOffset;
        const ctrlX = midX + perpX;
        const ctrlY = midY + perpY;

        return (
          <g key={`edge-${i}`}>
            <path
              d={`M ${x1} ${y1} Q ${ctrlX} ${ctrlY} ${x2} ${y2}`}
              fill="none"
              stroke="#666"
              strokeWidth={edgeStrokeWidth}
              strokeOpacity={GRAPH_NODE_STYLES.edgeStrokeOpacity}
              markerEnd={`url(#arrow-${isExpanded ? 'lg' : 'sm'})`}
            />
            {isExpanded && (
              <g transform={`translate(${midX + perpX * 0.5}, ${midY + perpY * 0.5})`}>
                <rect
                  x={GRAPH_NODE_STYLES.edgeLabelRectX}
                  y={GRAPH_NODE_STYLES.edgeLabelRectY}
                  width={GRAPH_NODE_STYLES.edgeLabelRectWidth}
                  height={GRAPH_NODE_STYLES.edgeLabelRectHeight}
                  rx="3"
                  fill={GRAPH_NODE_STYLES.edgeLabelBgColor}
                  fillOpacity={GRAPH_NODE_STYLES.edgeLabelBgOpacity}
                />
                <text
                  x="0"
                  y="3"
                  textAnchor="middle"
                  fill="#fff"
                  fontSize={GRAPH_NODE_STYLES.edgeLabelFontSize}
                  fontFamily="sans-serif"
                >
                  {edge.type}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* Nodes */}
      {layoutNodes.map((node, i) => {
        const iconScale = nodeRadius / 12;
        const iconSize = nodeRadius * 1.2;
        const labelText =
          node.value.length > maxLabelLength
            ? node.value.substring(0, truncateLength) + '...'
            : node.value;

        return (
          <g key={`node-${i}`} filter="url(#node-shadow)">
            <circle
              cx={node.x}
              cy={node.y}
              r={nodeRadius}
              fill={node.color}
              stroke="#fff"
              strokeWidth={strokeWidth}
            />
            <g
              transform={`translate(${node.x - iconSize / 2}, ${node.y - iconSize / 2}) scale(${iconScale})`}
            >
              <path d={getIconPath(node.type)} fill="#fff" fillOpacity={0.9} />
            </g>
            <text
              x={node.x}
              y={node.y + labelOffset}
              textAnchor="middle"
              fill={isExpanded ? '#333' : '#fff'}
              fontSize={fontSize}
              fontFamily="sans-serif"
              fontWeight={500}
              style={isExpanded ? {} : { filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))' }}
            >
              {labelText}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

// ============================================================================
// Main Component
// ============================================================================

interface Props {
  entities: EntityData[];
  relationships: RelationshipData[];
}

export const RelationshipMinimap: React.FC<Props> = ({ entities, relationships }) => {
  const [dialogOpen, setDialogOpen] = useState(false);

  const { nodes, edges } = useMemo(() => {
    const nodeMap = new Map<string, GraphNode>();

    entities.forEach(entity => {
      const key = entity.value.toLowerCase();
      if (!nodeMap.has(key)) {
        nodeMap.set(key, {
          id: key,
          value: entity.value,
          type: entity.type,
          x: 0,
          y: 0,
          color: getEntityColor(entity.type),
        });
      }
    });

    const edgeList: GraphEdge[] = [];
    relationships.forEach(rel => {
      const fromKey = rel.fromValue.toLowerCase();
      const toKey = rel.toValue.toLowerCase();

      if (!nodeMap.has(fromKey)) {
        nodeMap.set(fromKey, {
          id: fromKey,
          value: rel.fromValue,
          type: 'Unknown',
          x: 0,
          y: 0,
          color: '#666',
        });
      }

      if (!nodeMap.has(toKey)) {
        nodeMap.set(toKey, {
          id: toKey,
          value: rel.toValue,
          type: 'Unknown',
          x: 0,
          y: 0,
          color: '#666',
        });
      }

      edgeList.push({
        from: rel.fromValue,
        to: rel.toValue,
        type: rel.relationshipType,
      });
    });

    return { nodes: Array.from(nodeMap.values()), edges: edgeList };
  }, [entities, relationships]);

  const handleOpen = useCallback(() => setDialogOpen(true), []);
  const handleClose = useCallback(() => setDialogOpen(false), []);

  const uniqueTypes = useMemo(() => {
    const types = new Map<string, string>();
    nodes.forEach(n => types.set(n.type, n.color));
    return Array.from(types.entries());
  }, [nodes]);

  if (nodes.length === 0 && edges.length === 0) return null;

  return (
    <>
      {/* Minimap */}
      <Box
        onClick={handleOpen}
        sx={{
          position: 'fixed',
          bottom: 20,
          left: 20,
          width: MINIMAP_STYLES.width,
          height: MINIMAP_STYLES.height,
          background: `linear-gradient(135deg, ${MINIMAP_STYLES.bgStart} 0%, ${MINIMAP_STYLES.bgEnd} 100%)`,
          borderRadius: 2,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.1)',
          cursor: 'pointer',
          overflow: 'hidden',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          zIndex: 1000,
          '&:hover': {
            transform: 'scale(1.02)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(156, 39, 176, 0.3)',
          },
        }}
      >
        {/* Header */}
        <Box
          sx={{
            px: 1.25,
            py: 0.75,
            background: `rgba(156, 39, 176, ${MINIMAP_STYLES.accentBgOpacity})`,
            borderBottom: '1px solid rgba(156, 39, 176, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
          }}
        >
          <AccountTreeIcon sx={{ fontSize: 12, color: MINIMAP_STYLES.accentColor }} />
          <Typography
            sx={{
              fontSize: 10,
              fontWeight: 600,
              color: MINIMAP_STYLES.accentColor,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            Graph Overview
          </Typography>
        </Box>

        {/* Graph */}
        <Box
          sx={{
            width: '100%',
            height: `calc(100% - ${MINIMAP_STYLES.headerHeight}px)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <GraphVisualization
            nodes={nodes}
            edges={edges}
            width={MINIMAP_STYLES.width}
            height={MINIMAP_STYLES.graphHeight}
            isExpanded={false}
          />
        </Box>
      </Box>

      {/* Expanded Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={handleClose}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            background: `linear-gradient(135deg, ${MINIMAP_STYLES.bgStart} 0%, ${MINIMAP_STYLES.bgEnd} 100%)`,
            maxHeight: '80vh',
          },
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(156, 39, 176, 0.15)',
            borderBottom: '1px solid rgba(156, 39, 176, 0.2)',
            py: 1.5,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <AccountTreeIcon sx={{ color: MINIMAP_STYLES.accentColor }} />
            <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600 }}>
              Entity Relationship Graph
            </Typography>
            <Typography variant="caption" sx={{ color: MINIMAP_STYLES.accentColor, ml: 1 }}>
              {nodes.length} entities • {edges.length} relationships
            </Typography>
          </Box>
          <IconButton onClick={handleClose} sx={{ color: '#fff' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent
          sx={{
            p: 0,
            height: DIALOG_STYLES.graphHeight,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'radial-gradient(ellipse at center, rgba(156, 39, 176, 0.05) 0%, transparent 70%)',
            position: 'relative',
          }}
        >
          <GraphVisualization
            nodes={nodes}
            edges={edges}
            width={DIALOG_STYLES.graphWidth}
            height={DIALOG_STYLES.graphHeight}
            isExpanded={true}
          />

          {/* Legend */}
          <Box
            sx={{
              position: 'absolute',
              bottom: 16,
              right: 16,
              background: 'rgba(0,0,0,0.6)',
              borderRadius: 1,
              p: 1.5,
              maxWidth: 220,
            }}
          >
            <Typography
              sx={{
                fontSize: 11,
                fontWeight: 600,
                color: MINIMAP_STYLES.accentColor,
                mb: 1,
              }}
            >
              Entity Types
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {uniqueTypes.map(([type, color]) => (
                <Chip
                  key={type}
                  label={type}
                  size="small"
                  sx={{
                    bgcolor: color,
                    color: '#fff',
                    fontSize: 9,
                    height: 20,
                    '& .MuiChip-label': { px: 1 },
                  }}
                />
              ))}
            </Box>
          </Box>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default RelationshipMinimap;
