import { useState, useMemo, useCallback, useEffect } from 'react';
import { Tree, Input, Space, Button, Tooltip, Tag, Empty } from 'antd';
import {
  ApartmentOutlined,
  AppstoreOutlined,
  FolderOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  AimOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import type { TreeNodeData, SelectionInfo } from '../engine.ts';
import type { TreeProps } from 'antd';

const { Search } = Input;

function getIcon(icon?: string) {
  switch (icon) {
    case 'building':
    case 'storey':
      return <ApartmentOutlined />;
    case 'category':
    case 'element':
      return <AppstoreOutlined />;
    case 'folder':
    case 'model':
      return <FolderOutlined />;
    default:
      return <AppstoreOutlined />;
  }
}

const renderTitle = (node: TreeNodeData) => {
  const isLeaf = !node.children;
  const category = node.rawCategory || '';
  const name = node.rawName || '';
  
  let tagColor = 'default';
  if (category.includes('Project')) tagColor = 'blue';
  else if (category.includes('Site')) tagColor = 'cyan';
  else if (category.includes('Building') && !category.includes('Storey')) tagColor = 'gold';
  else if (category.includes('Storey')) tagColor = 'orange';
  else if (category.includes('Proxy') || category.includes('Element')) tagColor = 'purple';
  
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden', maxWidth: '100%' }}>
      {category && (
        <Tag 
          bordered={false} 
          color={tagColor} 
          style={{ 
            fontSize: '9px', 
            lineHeight: '14px', 
            height: '14px', 
            padding: '0 4px', 
            margin: 0,
            textTransform: 'uppercase'
          }}
        >
          {category.replace('Ifc', '')}
        </Tag>
      )}
      <span style={{ 
        fontSize: '11px', 
        color: isLeaf ? '#e2e8f0' : '#cbd5e0', 
        fontWeight: isLeaf ? 500 : 600,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {name || (node.localId !== undefined ? `#${node.localId}` : node.title)}
      </span>
    </div>
  );
};

function toAntdTreeData(nodes: TreeNodeData[], filter: string): TreeProps['treeData'] {
  const lowerFilter = filter.toLowerCase();
  return nodes
    .map((node) => {
      const children = node.children ? toAntdTreeData(node.children, filter) : undefined;
      const titleMatches = node.title.toLowerCase().includes(lowerFilter);
      const hasMatchingChildren = children && children.length > 0;
      if (!titleMatches && !hasMatchingChildren && lowerFilter) return null;
      return { key: node.key, title: renderTitle(node), icon: getIcon(node.icon), children };
    })
    .filter(Boolean) as TreeProps['treeData'];
}

interface ModelTreeProps {
  treeData: TreeNodeData[];
  onHighlight?: (modelIdMap: Record<string, Set<number>>) => void;
  onClearHighlight?: () => void;
  onHide?: (modelIdMap: Record<string, Set<number>>) => void;
  onIsolate?: (modelIdMap: Record<string, Set<number>>) => void;
  onShowAll?: () => void;
  onSelectElement?: (modelId: string, localId: number) => void;
  selection?: SelectionInfo | null;
}

export default function ModelTree({
  treeData, onHighlight, onClearHighlight, onHide, onIsolate, onShowAll, onSelectElement, selection,
}: ModelTreeProps) {
  const [filter, setFilter] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [checkedKeys, setCheckedKeys] = useState<string[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

  const antdTreeData = useMemo(() => toAntdTreeData(treeData, filter), [treeData, filter]);

  const nodeMap = useMemo(() => {
    const map = new Map<string, TreeNodeData>();
    function walk(nodes: TreeNodeData[]) {
      for (const n of nodes) { map.set(n.key, n); if (n.children) walk(n.children); }
    }
    walk(treeData);
    return map;
  }, [treeData]);

  // Expand top levels when treeData loads
  useEffect(() => {
    if (treeData.length > 0) {
      setExpandedKeys(treeData.map((n) => n.key));
    }
  }, [treeData]);

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

  const handleSelect: TreeProps['onSelect'] = (keys) => {
    setSelectedKeys(keys as string[]);
    if (keys.length === 0) { 
      onClearHighlight?.(); 
      return; 
    }
    
    const key = keys[0] as string;
    const node = nodeMap.get(key);
    
    // Call the callback to select the element when tree node is clicked
    if (node && node.modelId && node.localId !== undefined) {
      onSelectElement?.(node.modelId, node.localId);
    }
    
    const map = getNodeModelIdMap(key);
    if (map) onHighlight?.(map);
  };

  const handleCheck: TreeProps['onCheck'] = (checked) => {
    const keys = Array.isArray(checked) ? checked : checked.checked;
    setCheckedKeys(keys as string[]);
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

  if (treeData.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No model loaded" style={{ padding: '20px 0' }} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Search placeholder="Filter..." allowClear size="small" onChange={(e) => setFilter(e.target.value)} style={{ marginBottom: 8 }} />
      <Space size={4} style={{ marginBottom: 8 }} wrap>
        <Tooltip title="Hide checked"><Button size="small" icon={<EyeInvisibleOutlined />} disabled={checkedKeys.length === 0} onClick={() => { const m = getCheckedModelIdMap(); if (m) onHide?.(m); }} /></Tooltip>
        <Tooltip title="Isolate checked"><Button size="small" icon={<AimOutlined />} disabled={checkedKeys.length === 0} onClick={() => { const m = getCheckedModelIdMap(); if (m) onIsolate?.(m); }} /></Tooltip>
        <Tooltip title="Show all"><Button size="small" icon={<EyeOutlined />} onClick={onShowAll} /></Tooltip>
        <Tooltip title="Clear highlight"><Button size="small" icon={<ReloadOutlined />} onClick={onClearHighlight} /></Tooltip>
        {checkedKeys.length > 0 && <Tag color="blue">{checkedKeys.length} checked</Tag>}
      </Space>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <Tree 
          showIcon 
          checkable 
          showLine={{ showLeafIcon: false }} 
          expandedKeys={expandedKeys} 
          onExpand={(keys) => setExpandedKeys(keys as string[])} 
          selectedKeys={selectedKeys} 
          checkedKeys={checkedKeys} 
          onSelect={handleSelect} 
          onCheck={handleCheck} 
          treeData={antdTreeData} 
          style={{ fontSize: 12 }} 
        />
      </div>
    </div>
  );
}
