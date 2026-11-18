export type SplitDirection = "row" | "col";
export type SplitZone = "top" | "bottom" | "left" | "right";
export type DropZone = SplitZone | "center" | "tabbar";

export interface TerminalPaneLeaf {
  type: "leaf";
  id: string;
  tabIds: string[];
  activeTabId: string | null;
}

export interface TerminalPaneSplit {
  type: "split";
  id: string;
  direction: SplitDirection;
  ratio: number;
  first: TerminalPaneNode;
  second: TerminalPaneNode;
}

export type TerminalPaneNode = TerminalPaneLeaf | TerminalPaneSplit;

export const MIN_SPLIT_RATIO = 0.12;
export const MAX_SPLIT_RATIO = 0.88;

export const createPaneId = () => `terminal-pane-${crypto.randomUUID()}`;
export const createSplitId = () => `terminal-split-${crypto.randomUUID()}`;

export const createLeafPane = (
  tabIds: string[] = [],
  activeTabId: string | null = tabIds[0] ?? null,
  id = createPaneId(),
): TerminalPaneLeaf => ({
  type: "leaf",
  id,
  tabIds,
  activeTabId: tabIds.includes(activeTabId ?? "") ? activeTabId : (tabIds[0] ?? null),
});

export const clampSplitRatio = (ratio: number) =>
  Math.min(MAX_SPLIT_RATIO, Math.max(MIN_SPLIT_RATIO, ratio));

export const collectLeaves = (node: TerminalPaneNode): TerminalPaneLeaf[] => {
  if (node.type === "leaf") {
    return [node];
  }
  return [...collectLeaves(node.first), ...collectLeaves(node.second)];
};

export const findLeaf = (
  node: TerminalPaneNode,
  paneId: string,
): TerminalPaneLeaf | null => {
  if (node.type === "leaf") {
    return node.id === paneId ? node : null;
  }
  return findLeaf(node.first, paneId) ?? findLeaf(node.second, paneId);
};

export const findLeafByTabId = (
  node: TerminalPaneNode,
  tabId: string,
): TerminalPaneLeaf | null => {
  if (node.type === "leaf") {
    return node.tabIds.includes(tabId) ? node : null;
  }
  return findLeafByTabId(node.first, tabId) ?? findLeafByTabId(node.second, tabId);
};

export const updateLeaf = (
  node: TerminalPaneNode,
  paneId: string,
  updater: (leaf: TerminalPaneLeaf) => TerminalPaneLeaf,
): TerminalPaneNode => {
  if (node.type === "leaf") {
    return node.id === paneId ? updater(node) : node;
  }
  const nextFirst = updateLeaf(node.first, paneId, updater);
  const nextSecond = updateLeaf(node.second, paneId, updater);
  if (nextFirst === node.first && nextSecond === node.second) {
    return node;
  }
  return {
    ...node,
    first: nextFirst,
    second: nextSecond,
  };
};

export const updateSplitRatio = (
  node: TerminalPaneNode,
  splitId: string,
  ratio: number,
): TerminalPaneNode => {
  if (node.type === "leaf") {
    return node;
  }
  if (node.id === splitId) {
    const clamped = clampSplitRatio(ratio);
    return clamped === node.ratio ? node : { ...node, ratio: clamped };
  }
  const nextFirst = updateSplitRatio(node.first, splitId, ratio);
  const nextSecond = updateSplitRatio(node.second, splitId, ratio);
  if (nextFirst === node.first && nextSecond === node.second) {
    return node;
  }
  return {
    ...node,
    first: nextFirst,
    second: nextSecond,
  };
};

export const normalizePaneTree = (node: TerminalPaneNode): TerminalPaneNode => {
  const prune = (current: TerminalPaneNode): TerminalPaneNode | null => {
    if (current.type === "leaf") {
      if (current.tabIds.length === 0) {
        return null;
      }
      const activeTabId =
        current.activeTabId && current.tabIds.includes(current.activeTabId)
          ? current.activeTabId
          : current.tabIds[0];
      return activeTabId === current.activeTabId
        ? current
        : { ...current, activeTabId };
    }
    const first = prune(current.first);
    const second = prune(current.second);
    if (!first && !second) {
      return null;
    }
    if (!first) {
      return second;
    }
    if (!second) {
      return first;
    }
    if (first === current.first && second === current.second) {
      return current;
    }
    return {
      ...current,
      first,
      second,
    };
  };

  const pruned = prune(node);
  if (pruned) {
    return pruned;
  }
  // Preserve root leaf ID if already an empty single leaf
  if (node.type === "leaf") {
    return node.activeTabId === null ? node : { ...node, activeTabId: null };
  }
  return createLeafPane();
};

export const appendTabToLeaf = (
  root: TerminalPaneNode,
  paneId: string,
  tabId: string,
  activate = true,
): TerminalPaneNode => {
  const target = findLeaf(root, paneId) ?? collectLeaves(root)[0];
  if (!target) {
    return createLeafPane([tabId], tabId);
  }
  return updateLeaf(root, target.id, (leaf) => {
    const nextTabIds = leaf.tabIds.includes(tabId)
      ? leaf.tabIds
      : [...leaf.tabIds, tabId];
    return {
      ...leaf,
      tabIds: nextTabIds,
      activeTabId: activate ? tabId : (leaf.activeTabId ?? tabId),
    };
  });
};

export const insertTabAfterInLeaf = (
  root: TerminalPaneNode,
  afterTabId: string,
  newTabId: string,
  activate = true,
): TerminalPaneNode => {
  const leaf = findLeafByTabId(root, afterTabId);
  if (!leaf) {
    const fallback = collectLeaves(root)[0];
    return appendTabToLeaf(root, fallback?.id ?? "", newTabId, activate);
  }
  return updateLeaf(root, leaf.id, (current) => {
    if (current.tabIds.includes(newTabId)) {
      return {
        ...current,
        activeTabId: activate ? newTabId : current.activeTabId,
      };
    }
    const idx = current.tabIds.indexOf(afterTabId);
    const nextTabIds = [...current.tabIds];
    nextTabIds.splice(idx + 1, 0, newTabId);
    return {
      ...current,
      tabIds: nextTabIds,
      activeTabId: activate ? newTabId : current.activeTabId,
    };
  });
};

export const removeTabsFromTree = (
  root: TerminalPaneNode,
  removeIds: Set<string>,
): TerminalPaneNode => {
  const strip = (node: TerminalPaneNode): TerminalPaneNode => {
    if (node.type === "leaf") {
      const hasRemoved = node.tabIds.some((id) => removeIds.has(id));
      if (!hasRemoved) {
        return node;
      }
      const prevActiveIndex = node.activeTabId
        ? node.tabIds.indexOf(node.activeTabId)
        : -1;
      const nextTabIds = node.tabIds.filter((id) => !removeIds.has(id));
      let nextActive = node.activeTabId;
      if (!nextActive || removeIds.has(nextActive)) {
        if (nextTabIds.length === 0) {
          nextActive = null;
        } else {
          const fallbackIdx = Math.min(
            Math.max(prevActiveIndex, 0),
            nextTabIds.length - 1,
          );
          nextActive = nextTabIds[fallbackIdx] ?? nextTabIds[0];
        }
      }
      return {
        ...node,
        tabIds: nextTabIds,
        activeTabId: nextActive,
      };
    }
    return {
      ...node,
      first: strip(node.first),
      second: strip(node.second),
    };
  };

  return normalizePaneTree(strip(root));
};

export const reorderTabInLeaf = (
  root: TerminalPaneNode,
  paneId: string,
  sourceTabId: string,
  targetTabId: string,
): TerminalPaneNode =>
  updateLeaf(root, paneId, (leaf) => {
    const sourceIndex = leaf.tabIds.indexOf(sourceTabId);
    const targetIndex = leaf.tabIds.indexOf(targetTabId);
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
      return leaf;
    }
    const nextTabIds = [...leaf.tabIds];
    const [moved] = nextTabIds.splice(sourceIndex, 1);
    nextTabIds.splice(targetIndex, 0, moved);
    return {
      ...leaf,
      tabIds: nextTabIds,
    };
  });

export const splitLeafWithTab = (
  root: TerminalPaneNode,
  targetPaneId: string,
  zone: SplitZone,
  newTabId: string,
): { tree: TerminalPaneNode; newPaneId: string } => {
  const newPane = createLeafPane([newTabId], newTabId);
  const direction: SplitDirection =
    zone === "left" || zone === "right" ? "row" : "col";
  const placeNewFirst = zone === "left" || zone === "top";

  const replace = (node: TerminalPaneNode): TerminalPaneNode => {
    if (node.type === "leaf") {
      if (node.id !== targetPaneId) {
        return node;
      }
      if (node.tabIds.length === 0) {
        return {
          ...node,
          tabIds: [newTabId],
          activeTabId: newTabId,
        };
      }
      return {
        type: "split",
        id: createSplitId(),
        direction,
        ratio: 0.5,
        first: placeNewFirst ? newPane : node,
        second: placeNewFirst ? node : newPane,
      };
    }
    return {
      ...node,
      first: replace(node.first),
      second: replace(node.second),
    };
  };

  const nextTree = replace(root);
  const targetWasEmpty =
    findLeaf(root, targetPaneId)?.tabIds.length === 0;
  return {
    tree: nextTree,
    newPaneId: targetWasEmpty ? targetPaneId : newPane.id,
  };
};

export const moveTabAcrossPanes = (
  root: TerminalPaneNode,
  tabId: string,
  targetPaneId: string,
  zone: DropZone,
  insertBeforeTabId?: string | null,
): { tree: TerminalPaneNode; activePaneId: string } => {
  const sourceLeaf = findLeafByTabId(root, tabId);
  const targetLeaf = findLeaf(root, targetPaneId);
  if (!sourceLeaf || !targetLeaf) {
    return { tree: root, activePaneId: targetPaneId };
  }

  // Dropping into the same pane when it only has this single tab is a no-op
  if (sourceLeaf.id === targetLeaf.id && sourceLeaf.tabIds.length <= 1) {
    return { tree: root, activePaneId: sourceLeaf.id };
  }

  if (zone === "center" || zone === "tabbar") {
    if (sourceLeaf.id === targetLeaf.id) {
      if (insertBeforeTabId && insertBeforeTabId !== tabId) {
        return {
          tree: reorderTabInLeaf(root, sourceLeaf.id, tabId, insertBeforeTabId),
          activePaneId: sourceLeaf.id,
        };
      }
      return {
        tree: updateLeaf(root, sourceLeaf.id, (leaf) => ({
          ...leaf,
          activeTabId: tabId,
        })),
        activePaneId: sourceLeaf.id,
      };
    }

    // Remove from source leaf without changing relative order of remaining tabs
    const withoutSource = updateLeaf(root, sourceLeaf.id, (leaf) => {
      const prevIdx = leaf.tabIds.indexOf(tabId);
      const nextIds = leaf.tabIds.filter((id) => id !== tabId);
      const nextActive =
        leaf.activeTabId === tabId
          ? (nextIds[Math.min(prevIdx, nextIds.length - 1)] ?? null)
          : leaf.activeTabId;
      return {
        ...leaf,
        tabIds: nextIds,
        activeTabId: nextActive,
      };
    });

    // Insert into target leaf
    const withTarget = updateLeaf(withoutSource, targetLeaf.id, (leaf) => {
      const filtered = leaf.tabIds.filter((id) => id !== tabId);
      let nextIds: string[];
      if (insertBeforeTabId && filtered.includes(insertBeforeTabId)) {
        const idx = filtered.indexOf(insertBeforeTabId);
        nextIds = [...filtered];
        nextIds.splice(idx, 0, tabId);
      } else {
        nextIds = [...filtered, tabId];
      }
      return {
        ...leaf,
        tabIds: nextIds,
        activeTabId: tabId,
      };
    });

    return {
      tree: normalizePaneTree(withTarget),
      activePaneId: targetLeaf.id,
    };
  }

  // Split zone ("top" | "bottom" | "left" | "right")
  // Remove tab from source leaf first (keeping remaining tabs' order untouched),
  // then split the target leaf (which may be the same leaf if it had >= 2 tabs).
  const stripped = updateLeaf(root, sourceLeaf.id, (leaf) => {
    const prevIdx = leaf.tabIds.indexOf(tabId);
    const nextIds = leaf.tabIds.filter((id) => id !== tabId);
    const nextActive =
      leaf.activeTabId === tabId
        ? (nextIds[Math.min(prevIdx, nextIds.length - 1)] ?? null)
        : leaf.activeTabId;
    return {
      ...leaf,
      tabIds: nextIds,
      activeTabId: nextActive,
    };
  });

  const { tree: splitResult, newPaneId } = splitLeafWithTab(
    stripped,
    targetLeaf.id,
    zone,
    tabId,
  );

  return {
    tree: normalizePaneTree(splitResult),
    activePaneId: newPaneId,
  };
};
