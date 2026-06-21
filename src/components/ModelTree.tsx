/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Table, Input, Space, Button, Tooltip, Tag, Empty } from 'antd';
import {
  EyeOutlined,
  EyeInvisibleOutlined,
  AimOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import type { TreeNodeData, SelectionInfo } from '../engine.ts';

const { Search } = Input;

function filterTreeData(nodes: TreeNodeData[], filter: string): TreeNodeData[] {
  if (!filter) return nodes;
  const lowerFilter = filter.toLowerCase();
  return nodes
    .map((node) => {
      const children = node.children ? filterTreeData(node.children, filter) : undefined;
      const categoryMatches = (node.rawCategory || '').toLowerCase().includes(lowerFilter);
      const nameMatches = (node.rawName || '').toLowerCase().includes(lowerFilter);
      const titleMatches = node.title.toLowerCase().includes(lowerFilter);
      const matches = categoryMatches || nameMatches || titleMatches;
      const hasMatchingChildren = children && children.length > 0;
      if (!matches && !hasMatchingChildren) return null;
      return { ...node, children };
    })
    .filter(Boolean) as TreeNodeData[];
}

interface ModelTreeProps {
  treeData: TreeNodeData[];
  onHighlight?: (modelIdMap: Record<string, Set<number>>) => void;
  onClearHighlight?: () => void;
  onHide?: (modelIdMap: Record<string, Set<number>>) => void;
  onShow?: (modelIdMap: Record<string, Set<number>>) => void; // Added for active checkbox view
  onIsolate?: (modelIdMap: Record<string, Set<number>>) => void;
  onShowAll?: () => void;
  onSelectElement?: (modelId: string, localId: number) => void;
  selection?: SelectionInfo | null;
}

export default function ModelTree({
  treeData, onHighlight, onClearHighlight, onHide, onShow, onIsolate, onShowAll, onSelectElement, selection,
}: ModelTreeProps) {
  const [filter, setFilter] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [checkedKeys, setCheckedKeys] = useState<string[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

  const filteredData = useMemo(() => filterTreeData(treeData, filter), [treeData, filter]);

  const nodeMap = useMemo(() => {
    const map = new Map<string, TreeNodeData>();
    function walk(nodes: TreeNodeData[]) {
      for (const n of nodes) { map.set(n.key, n); if (n.children) walk(n.children); }
    }
    walk(treeData);
    return map;
  }, [treeData]);

  const prevCheckedKeys = useRef<string[]>([]);

  // Expand top levels and check all keys when treeData loads
  useEffect(() => {
    if (treeData.length > 0) {
      setExpandedKeys(treeData.map((n) => n.key));
      
      const allKeys: string[] = [];
      function collectKeys(nodes: TreeNodeData[]) {
        for (const n of nodes) {
          allKeys.push(n.key);
          if (n.children) collectKeys(n.children);
        }
      }
      collectKeys(treeData);
      prevCheckedKeys.current = allKeys; // Prevent initial onShow trigger
      setCheckedKeys(allKeys);
    }
  }, [treeData]);

  // Helper to find path to the key
  function getParentKeys(nodes: TreeNodeData[], targetKey: string, path: string[]): boolean {
    for (const n of nodes) {
      if (n.key === targetKey) return true;
      if (n.children) {
        path.push(n.key);
        if (getParentKeys(n.children, targetKey, path)) return true;
        path.pop();
      }
    }
    return false;
  }

  // Synchronize 3D selection back to tree selection & auto-expand parents
  useEffect(() => {
    if (!selection) {
      setSelectedKeys([]);
      return;
    }
    
    // Find matching node
    let foundNode: TreeNodeData | null = null;
    for (const node of nodeMap.values()) {
      if (node.modelId === selection.modelId && node.localId === selection.localId) {
        foundNode = node;
        break;
      }
    }
    
    if (foundNode) {
      setSelectedKeys([foundNode.key]);
      
      const newExpandedKeys = new Set(expandedKeys);
      const path: string[] = [];
      if (getParentKeys(treeData, foundNode.key, path)) {
        for (const pk of path) {
          newExpandedKeys.add(pk);
        }
        setExpandedKeys(Array.from(newExpandedKeys));
      }
    }
  }, [selection, nodeMap, treeData]);

  const getNodeModelIdMap = useCallback(
    (key: string): Record<string, Set<number>> | null => {
      const node = nodeMap.get(key);
      if (!node) return null;
      if (node.modelIdMap) return node.modelIdMap;
      if (node.children) {
        const merged: Record<string, Set<number>> = {};
        for (const child of node.children) {
          const childMap = getNodeModelIdMap(child.key);
          if (childMap) for (const [mid, ids] of Object.entries(childMap)) {
            if (!merged[mid]) merged[mid] = new Set();
            for (const id of ids) merged[mid].add(id);
          }
        }
        return Object.keys(merged).length > 0 ? merged : null;
      }
      return null;
    },
    [nodeMap],
  );

  // Monitor checkedKeys changes to immediately toggle element visibility
  useEffect(() => {
    const added = checkedKeys.filter((k) => !prevCheckedKeys.current.includes(k));
    const removed = prevCheckedKeys.current.filter((k) => !checkedKeys.includes(k));

    if (added.length > 0) {
      const mergedShow: Record<string, Set<number>> = {};
      for (const key of added) {
        const map = getNodeModelIdMap(key);
        if (map) {
          for (const [mid, ids] of Object.entries(map)) {
            if (!mergedShow[mid]) mergedShow[mid] = new Set();
            for (const id of ids) mergedShow[mid].add(id);
          }
        }
      }
      if (Object.keys(mergedShow).length > 0) {
        onShow?.(mergedShow);
      }
    }

    if (removed.length > 0) {
      const mergedHide: Record<string, Set<number>> = {};
      for (const key of removed) {
        const map = getNodeModelIdMap(key);
        if (map) {
          for (const [mid, ids] of Object.entries(map)) {
            if (!mergedHide[mid]) mergedHide[mid] = new Set();
            for (const id of ids) mergedHide[mid].add(id);
          }
        }
      }
      if (Object.keys(mergedHide).length > 0) {
        onHide?.(mergedHide);
      }
    }

    prevCheckedKeys.current = checkedKeys;
  }, [checkedKeys, getNodeModelIdMap, onShow, onHide]);

  const handleRowClick = (record: TreeNodeData) => {
    setSelectedKeys([record.key]);
    
    if (record.modelId && record.localId !== undefined) {
      onSelectElement?.(record.modelId, record.localId);
    }
    
    const map = getNodeModelIdMap(record.key);
    if (map) onHighlight?.(map);
  };

  const getCheckedModelIdMap = useCallback((): Record<string, Set<number>> | null => {
    if (checkedKeys.length === 0) return null;
    const merged: Record<string, Set<number>> = {};
    for (const key of checkedKeys) {
      const map = getNodeModelIdMap(key);
      if (map) for (const [mid, ids] of Object.entries(map)) {
        if (!merged[mid]) merged[mid] = new Set();
        for (const id of ids) merged[mid].add(id);
      }
    }
    return Object.keys(merged).length > 0 ? merged : null;
  }, [checkedKeys, getNodeModelIdMap]);

  const columns = [
    {
      title: 'Type',
      dataIndex: 'rawCategory',
      key: 'type',
      width: '35%',
      render: (text: string, record: TreeNodeData) => {
        return (
          <span style={{ 
            fontSize: '12px', 
            fontWeight: record.children ? 600 : 400, 
            color: record.children ? '#cbd5e0' : '#e2e8f0',
            verticalAlign: 'middle' 
          }}>
            {record.rawCategory || ''}
          </span>
        );
      }
    },
    {
      title: 'Name',
      dataIndex: 'rawName',
      key: 'name',
      width: '35%',
      render: (text: string, record: TreeNodeData) => {
        const isLeaf = !record.children;
        return (
          <span style={{ 
            fontSize: '11px', 
            color: isLeaf ? '#e2e8f0' : '#cbd5e0', 
            fontWeight: isLeaf ? 500 : 600,
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {record.rawName || (record.localId !== undefined ? `#${record.localId}` : '')}
          </span>
        );
      }
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      width: '30%',
      render: (text: string, record: TreeNodeData) => {
        return (
          <span style={{ 
            fontSize: '11px', 
            color: '#a0aec0',
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {record.description || ''}
          </span>
        );
      }
    }
  ];

  if (treeData.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No model loaded" style={{ padding: '20px 0' }} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Search placeholder="Filter..." allowClear size="small" onChange={(e) => setFilter(e.target.value)} style={{ marginBottom: 8 }} />
      <Space size={4} style={{ marginBottom: 8 }} wrap>
        <Tooltip title="Hide checked"><Button size="small" icon={<EyeInvisibleOutlined />} disabled={checkedKeys.length === 0} onClick={() => { const m = getCheckedModelIdMap(); if (m) onHide?.(m); }} /></Tooltip>
        <Tooltip title="Isolate checked"><Button size="small" icon={<AimOutlined />} disabled={checkedKeys.length === 0} onClick={() => { const m = getCheckedModelIdMap(); if (m) onIsolate?.(m); }} /></Tooltip>
        <Tooltip title="Show all">
          <Button 
            size="small" 
            icon={<EyeOutlined />} 
            onClick={() => {
              const allKeys: string[] = [];
              function collectKeys(nodes: TreeNodeData[]) {
                for (const n of nodes) {
                  allKeys.push(n.key);
                  if (n.children) collectKeys(n.children);
                }
              }
              collectKeys(treeData);
              setCheckedKeys(allKeys);
              onShowAll?.();
            }} 
          />
        </Tooltip>
        <Tooltip title="Clear highlight"><Button size="small" icon={<ReloadOutlined />} onClick={onClearHighlight} /></Tooltip>
        {checkedKeys.length > 0 && <Tag color="blue">{checkedKeys.length} checked</Tag>}
      </Space>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <Table
          key={treeData.length > 0 ? treeData[0].key : 'empty'}
          dataSource={filteredData}
          columns={columns}
          size="small"
          pagination={false}
          rowSelection={{
            type: 'checkbox',
            columnTitle: <span style={{ fontSize: 10, fontWeight: 600, color: '#a0aec0' }}>Active</span>,
            selectedRowKeys: checkedKeys,
            onChange: (keys) => setCheckedKeys(keys as string[]),
            checkStrictly: false,
          }}
          expandable={{
            expandedRowKeys: expandedKeys,
            onExpandedRowsChange: (keys) => setExpandedKeys(keys as string[]),
            expandIconColumnIndex: 1,
          }}
          bordered
          rowKey="key"
          onRow={(record) => ({
            onClick: (e) => {
              if ((e.target as HTMLElement).closest('.ant-table-selection-column')) return;
              handleRowClick(record);
            },
          })}
          rowClassName={(record) => selectedKeys.includes(record.key) ? 'ant-table-row-selected' : ''}
          className="ifc-structure-table"
        />
      </div>
    </div>
  );
}
