/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Tree, Input, Space, Button, Tooltip, Tag, Empty, Dropdown } from 'antd';
import {
  EyeOutlined,
  EyeInvisibleOutlined,
  AimOutlined,
  ReloadOutlined,
  ApartmentOutlined,
  AppstoreOutlined,
  FolderOutlined,
} from '@ant-design/icons';
import type { TreeNodeData, SelectionInfo } from '../engine.ts';
import type { TreeProps } from 'antd';

const { Search } = Input;

/** Map icon string → Antd icon component with custom colors */
function getIcon(icon?: string) {
  switch (icon) {
    case 'building':
    case 'storey':
      return <ApartmentOutlined style={{ color: '#90cdf4', fontSize: '14px' }} />;
    case 'category':
      return <FolderOutlined style={{ color: '#f6ad55', fontSize: '14px' }} />;
    case 'folder':
    case 'model':
      return <FolderOutlined style={{ color: '#4fd1c5', fontSize: '14px' }} />;
    case 'element':
    case 'wall':
    case 'slab':
    case 'column':
    case 'beam':
    default:
      return <AppstoreOutlined style={{ color: '#a0aec0', fontSize: '13px' }} />;
  }
}

interface ModelTreeProps {
  treeData: TreeNodeData[];
  onHighlight?: (modelIdMap: Record<string, Set<number>>) => void;
  onClearHighlight?: () => void;
  onHide?: (modelIdMap: Record<string, Set<number>>) => void;
  onShow?: (modelIdMap: Record<string, Set<number>>) => void;
  onIsolate?: (modelIdMap: Record<string, Set<number>>) => void;
  onShowAll?: () => void;
  onSelectElement?: (modelId: string, localId: number) => void;
  selection?: SelectionInfo | null;
}

export default function ModelTree({
  treeData,
  onHighlight,
  onClearHighlight,
  onHide,
  onShow,
  onIsolate,
  onShowAll,
  onSelectElement,
  selection,
}: ModelTreeProps) {
  const [filter, setFilter] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [checkedKeys, setCheckedKeys] = useState<string[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

  const nodeMap = useMemo(() => {
    const map = new Map<string, TreeNodeData>();
    function walk(nodes: TreeNodeData[]) {
      for (const n of nodes) {
        map.set(n.key, n);
        if (n.children) walk(n.children);
      }
    }
    walk(treeData);
    return map;
  }, [treeData]);

  const prevCheckedKeys = useRef<string[]>([]);

  // Expand top levels and check all keys when treeData loads
  useEffect(() => {
    if (treeData.length > 0) {
      // Collect all keys down to storey level (Project, Site, Building, Storey, Model)
      const keysToExpand: string[] = [];
      function collectSpatialKeys(nodes: TreeNodeData[]) {
        for (const n of nodes) {
          const isSpatial = n.icon === 'building' || n.icon === 'folder' || n.icon === 'storey' || n.icon === 'model';
          if (isSpatial) {
            keysToExpand.push(n.key);
            if (n.children) {
              collectSpatialKeys(n.children);
            }
          }
        }
      }
      collectSpatialKeys(treeData);
      setExpandedKeys(keysToExpand);
      
      const allKeys: string[] = [];
      function collectKeys(nodes: TreeNodeData[]) {
        for (const n of nodes) {
          allKeys.push(n.key);
          if (n.children) collectKeys(n.children);
        }
      }
      collectKeys(treeData);
      prevCheckedKeys.current = allKeys;
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
          if (childMap) {
            for (const [mid, ids] of Object.entries(childMap)) {
              if (!merged[mid]) merged[mid] = new Set();
              for (const id of ids) merged[mid].add(id);
            }
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

  const handleSelect = (keys: React.Key[]) => {
    setSelectedKeys(keys as string[]);
    if (keys.length === 0) return;
    
    const record = nodeMap.get(keys[0] as string);
    if (!record) return;

    if (record.modelId && record.localId !== undefined) {
      onSelectElement?.(record.modelId, record.localId);
    }
    
    const map = getNodeModelIdMap(record.key);
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
      if (map) {
        for (const [mid, ids] of Object.entries(map)) {
          if (!merged[mid]) merged[mid] = new Set();
          for (const id of ids) merged[mid].add(id);
        }
      }
    }
    return Object.keys(merged).length > 0 ? merged : null;
  }, [checkedKeys, getNodeModelIdMap]);

  // Context menu layout on right-click
  const contextMenu = useCallback(
    (key: string) => ({
      items: [
        { key: 'isolate', label: '🎯 Cô lập cấu kiện', icon: <AimOutlined /> },
        { key: 'hide', label: '👁️ Ẩn cấu kiện', icon: <EyeInvisibleOutlined /> },
        { key: 'show', label: '👁️ Chỉ hiển thị cấu kiện này', icon: <EyeOutlined /> },
      ],
      onClick: ({ key: action }: { key: string }) => {
        const map = getNodeModelIdMap(key);
        if (!map) return;
        if (action === 'isolate') {
          onIsolate?.(map);
        } else if (action === 'hide') {
          onHide?.(map);
          // Sync check state in Tree: remove keys corresponding to hidden items
          setCheckedKeys(prev => prev.filter(k => k !== key));
        } else if (action === 'show') {
          onShowAll?.();
          onHighlight?.(map);
        }
      },
    }),
    [getNodeModelIdMap, onIsolate, onHide, onShowAll, onHighlight],
  );

  // Recursively maps tree data structure to Ant Design format, applying context menu and filter
  const mapNodesToTreeData = useCallback(
    (nodes: TreeNodeData[], search: string): TreeProps['treeData'] => {
      const lower = search.toLowerCase();
      return nodes
        .map((node) => {
          const children = node.children
            ? mapNodesToTreeData(node.children, search)
            : undefined;

          const titleMatches = node.title.toLowerCase().includes(lower);
          const categoryMatches = (node.rawCategory || '').toLowerCase().includes(lower);
          const nameMatches = (node.rawName || '').toLowerCase().includes(lower);
          const matches = titleMatches || categoryMatches || nameMatches;
          const hasMatchingChildren = children && children.length > 0;

          if (!matches && !hasMatchingChildren && lower) return null;

          const isLeaf = !node.children;

          const titleElement = (
            <Dropdown menu={contextMenu(node.key)} trigger={['contextMenu']}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ 
                  fontSize: isLeaf ? '12px' : '13px', 
                  fontWeight: isLeaf ? 400 : 600, 
                  color: isLeaf ? '#e2e8f0' : '#cbd5e0',
                  userSelect: 'none'
                }}>
                  {node.title}
                </span>
                {node.rawCategory && node.rawCategory !== node.title && (
                  <Tag style={{ fontSize: '9px', padding: '0 4px', margin: 0, background: 'rgba(107, 70, 193, 0.2)', borderColor: 'rgba(107, 70, 193, 0.4)', color: '#d6bcfa', border: '1px solid' }}>
                    {node.rawCategory}
                  </Tag>
                )}
              </span>
            </Dropdown>
          );

          return {
            key: node.key,
            title: titleElement,
            icon: getIcon(node.icon),
            children: children && children.length > 0 ? children : undefined,
          };
        })
        .filter(Boolean) as TreeProps['treeData'];
    },
    [contextMenu],
  );

  const filteredTreeData = useMemo(
    () => mapNodesToTreeData(treeData, filter),
    [treeData, filter, mapNodesToTreeData],
  );

  if (treeData.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No model loaded" style={{ padding: '20px 0' }} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Search placeholder="Filter tree..." allowClear size="small" onChange={(e) => setFilter(e.target.value)} style={{ marginBottom: 8 }} />
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
        <Tree
          checkable
          showIcon
          showLine={{ showLeafIcon: false }}
          defaultExpandedKeys={treeData.map((n) => n.key)}
          expandedKeys={expandedKeys}
          onExpand={(keys) => setExpandedKeys(keys as string[])}
          checkedKeys={checkedKeys}
          selectedKeys={selectedKeys}
          onCheck={handleCheck}
          onSelect={handleSelect}
          treeData={filteredTreeData}
          className="ifc-structure-tree"
        />
      </div>
    </div>
  );
}
