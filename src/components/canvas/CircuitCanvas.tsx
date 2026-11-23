import React, { useCallback, useState } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  ConnectionMode,
  type Connection,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type OnNodesDelete,
  type OnEdgesDelete,
  addEdge,
  MarkerType,
} from '@xyflow/react';
import { Trash2 } from 'lucide-react';
import { circuitNodeTypes } from '../nodes/nodeTypes.ts';
import type { CircuitNode, CircuitEdge } from '../../types/flow.ts';

export interface CircuitCanvasProps {
  nodes: CircuitNode[];
  edges: CircuitEdge[];
  onNodesUpdate: (nodes: CircuitNode[]) => void;
  onEdgesUpdate: (edges: CircuitEdge[]) => void;
  onConnectEdge?: (connection: Connection) => void;
  onNodesDelete?: (deletedNodes: CircuitNode[]) => void;
  onEdgesDelete?: (deletedEdges: CircuitEdge[]) => void;
}

export const CircuitCanvas: React.FC<CircuitCanvasProps> = ({
  nodes,
  edges,
  onNodesUpdate,
  onEdgesUpdate,
  onConnectEdge,
  onNodesDelete,
  onEdgesDelete,
}) => {
  const [selectedNodes, setSelectedNodes] = useState<CircuitNode[]>([]);
  const [selectedEdges, setSelectedEdges] = useState<CircuitEdge[]>([]);

  const onNodesChange: OnNodesChange<CircuitNode> = useCallback(
    (changes) => {
      const updated = changes.applyTo(nodes);
      onNodesUpdate(updated);
    },
    [nodes, onNodesUpdate]
  );

  const onEdgesChange: OnEdgesChange<CircuitEdge> = useCallback(
    (changes) => {
      const updated = changes.applyTo(edges);
      onEdgesUpdate(updated);
    },
    [edges, onEdgesUpdate]
  );

  const handleConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (onConnectEdge) {
        onConnectEdge(connection);
      } else {
        const newEdge: CircuitEdge = {
          id: `${connection.source}.${connection.sourceHandle}->${connection.target}.${connection.targetHandle}`,
          source: connection.source,
          sourceHandle: connection.sourceHandle,
          target: connection.target,
          targetHandle: connection.targetHandle,
          type: 'smoothstep',
          style: { stroke: '#38bdf8', strokeWidth: 2 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#38bdf8',
            width: 14,
            height: 14,
          },
          pathOptions: { borderRadius: 12, offset: 25 },
        };
        onEdgesUpdate(addEdge(newEdge, edges) as CircuitEdge[]);
      }
    },
    [edges, onConnectEdge, onEdgesUpdate]
  );

  const handleNodesDelete: OnNodesDelete<CircuitNode> = useCallback(
    (deleted) => {
      if (onNodesDelete) {
        onNodesDelete(deleted);
      }
      setSelectedNodes([]);
    },
    [onNodesDelete]
  );

  const handleEdgesDelete: OnEdgesDelete<CircuitEdge> = useCallback(
    (deleted) => {
      if (onEdgesDelete) {
        onEdgesDelete(deleted);
      }
      setSelectedEdges([]);
    },
    [onEdgesDelete]
  );

  const handleSelectionChange = useCallback(
    (params: { nodes: CircuitNode[]; edges: CircuitEdge[] }) => {
      setSelectedNodes(params.nodes);
      setSelectedEdges(params.edges);
    },
    []
  );

  const handleDeleteSelected = useCallback(() => {
    if (selectedNodes.length > 0 && onNodesDelete) {
      onNodesDelete(selectedNodes);
      setSelectedNodes([]);
    }
    if (selectedEdges.length > 0 && onEdgesDelete) {
      onEdgesDelete(selectedEdges);
      setSelectedEdges([]);
    }
  }, [selectedNodes, selectedEdges, onNodesDelete, onEdgesDelete]);

  const hasSelection = selectedNodes.length > 0 || selectedEdges.length > 0;

  return (
    <div
      className="w-full h-full min-w-0 min-h-0 flex-1 relative select-none bg-slate-950"
      style={{ width: '100%', height: '100%' }}
    >
      {/* Contextual Floating Delete Button when items are selected */}
      {hasSelection && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/95 border border-slate-700 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-2">
          <span className="text-xs text-slate-300 font-mono">
            {selectedNodes.length > 0
              ? `Component: ${selectedNodes.map((n) => n.id).join(', ')}`
              : `Wire: ${
                  selectedEdges[0]?.label ||
                  `${selectedEdges[0]?.source}.${selectedEdges[0]?.sourceHandle} -> ${selectedEdges[0]?.target}.${selectedEdges[0]?.targetHandle}`
                }`}
          </span>
          <button
            onClick={handleDeleteSelected}
            title="Delete selected item (Delete or Backspace)"
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/50 hover:border-rose-400 text-xs font-semibold transition-all shadow-sm"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
            <kbd className="text-[10px] font-mono bg-rose-950/80 px-1 rounded text-rose-200 ml-0.5">
              Del
            </kbd>
          </button>
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={circuitNodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onNodesDelete={handleNodesDelete}
        onEdgesDelete={handleEdgesDelete}
        onSelectionChange={handleSelectionChange}
        deleteKeyCode={['Backspace', 'Delete']}
        connectionMode={ConnectionMode.Loose}
        fitView
        snapToGrid={true}
        snapGrid={[16, 16]}
        style={{ width: '100%', height: '100%' }}
        defaultEdgeOptions={{
          type: 'smoothstep',
          style: { stroke: '#94a3b8', strokeWidth: 2.2 },
          pathOptions: { borderRadius: 12, offset: 25 },
        } as any}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={16}
          size={1.2}
          color="#334155"
        />
        <Controls
          className="!bg-slate-900 !border-slate-700 !shadow-xl"
          showInteractive={false}
        />
      </ReactFlow>
    </div>
  );
};
