import React, { useCallback, useEffect, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  Panel,
  ConnectionMode,
  useReactFlow,
  type Connection,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type OnNodesDelete,
  type OnEdgesDelete,
  addEdge,
  MarkerType,
} from '@xyflow/react';
import { Crosshair, Trash2 } from 'lucide-react';
import { circuitNodeTypes } from '../nodes/nodeTypes.ts';
import { circuitEdgeTypes } from '../edges/edgeTypes.ts';
import type { CircuitNode, CircuitEdge } from '../../types/flow.ts';
import { CENTER_VIEW_EVENT } from '../../lib/viewportEvents.ts';

export interface CircuitCanvasProps {
  nodes: CircuitNode[];
  edges: CircuitEdge[];
  onNodesUpdate: (nodes: CircuitNode[]) => void;
  onEdgesUpdate: (edges: CircuitEdge[]) => void;
  onConnectEdge?: (connection: Connection) => void;
  onNodesDelete?: (deletedNodes: CircuitNode[]) => void;
  onEdgesDelete?: (deletedEdges: CircuitEdge[]) => void;
  onOpenEsp32Code?: (componentId: string) => void;
}

const CircuitCanvasInner: React.FC<CircuitCanvasProps> = ({
  nodes,
  edges,
  onNodesUpdate,
  onEdgesUpdate,
  onConnectEdge,
  onNodesDelete,
  onEdgesDelete,
  onOpenEsp32Code,
}) => {
  const [selectedNodes, setSelectedNodes] = useState<CircuitNode[]>([]);
  const [selectedEdges, setSelectedEdges] = useState<CircuitEdge[]>([]);
  const { fitView, setViewport, getNodes } = useReactFlow();

  const handleCenterView = useCallback(() => {
    if (getNodes().length > 0) {
      void fitView({ padding: 0.25, duration: 350, maxZoom: 1.2 });
    } else {
      void setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 350 });
    }
  }, [getNodes, fitView, setViewport]);

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
      if (target.isContentEditable) return true;
      return Boolean(
        target.closest(
          '.monaco-editor, [contenteditable="true"], [role="textbox"]'
        )
      );
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key !== 'f' && key !== 'c') return;
      if (isEditableTarget(event.target)) return;
      event.preventDefault();
      handleCenterView();
    };

    const handleCenterRequest = () => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => handleCenterView());
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener(CENTER_VIEW_EVENT, handleCenterRequest);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener(CENTER_VIEW_EVENT, handleCenterRequest);
    };
  }, [handleCenterView]);

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
          type: 'wire',
          selectable: true,
          deletable: true,
          style: { stroke: '#38bdf8', strokeWidth: 3 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#38bdf8',
            width: 14,
            height: 14,
          },
          pathOptions: { borderRadius: 8, offset: 12 },
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

  const handleNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: CircuitNode) => {
      if (node.data.componentType === 'ESP32_30Pin' && onOpenEsp32Code) {
        onOpenEsp32Code(node.id);
      }
    },
    [onOpenEsp32Code]
  );

  const handleEdgeDoubleClick = useCallback(
    (_event: React.MouseEvent, edge: CircuitEdge) => {
      if (onEdgesDelete) {
        onEdgesDelete([edge]);
      }
      setSelectedEdges([]);
    },
    [onEdgesDelete]
  );

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
        edgeTypes={circuitEdgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onNodesDelete={handleNodesDelete}
        onEdgesDelete={handleEdgesDelete}
        onSelectionChange={handleSelectionChange}
        onNodeDoubleClick={handleNodeDoubleClick}
        onEdgeDoubleClick={handleEdgeDoubleClick}
        {...({ edgesDeletable: true } as any)}
        deleteKeyCode={['Backspace', 'Delete']}
        connectionMode={ConnectionMode.Loose}
        fitView
        snapToGrid={true}
        snapGrid={[16, 16]}
        style={{ width: '100%', height: '100%' }}
        defaultEdgeOptions={{
          type: 'wire',
          selectable: true,
          deletable: true,
          style: { stroke: '#94a3b8', strokeWidth: 3 },
          pathOptions: { borderRadius: 8, offset: 12 },
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
        <Panel position="bottom-right" className="!m-0 !mb-8 !mr-2">
          <button
            onClick={handleCenterView}
            title="Center view (F or C)"
            aria-label="Center view"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900/95 hover:bg-slate-800 text-slate-200 border border-slate-700 hover:border-sky-500/70 text-xs font-semibold shadow-xl backdrop-blur-md transition-colors"
          >
            <Crosshair className="w-4 h-4 text-sky-400 shrink-0" />
            <span className="hidden sm:inline">Center</span>
            <kbd className="hidden md:inline text-[10px] font-mono bg-slate-800 px-1 rounded text-slate-400 border border-slate-700">
              F
            </kbd>
          </button>
        </Panel>
      </ReactFlow>
    </div>
  );
};

export const CircuitCanvas: React.FC<CircuitCanvasProps> = (props) => (
  <ReactFlowProvider>
    <CircuitCanvasInner {...props} />
  </ReactFlowProvider>
);
