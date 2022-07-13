import _ from 'lodash';

import generateVegaData from 'components/plots/helpers/heatmap/vega/generateVegaData';
import generateVitessceData from 'components/plots/helpers/heatmap/vitessce/generateVitessceData';

import SetOperations from 'utils/setOperations';
import { union } from 'utils/cellSetOperations';
import { reversed } from 'utils/arrayUtils';

const populateHeatmapData = (
  cellSets, heatmapSettings, expression,
  selectedGenes, downsampling = false, vitessce = false,
) => {
  const { hierarchy, properties, hidden } = cellSets;
  const { selectedTracks, groupedTracks } = heatmapSettings;

  const maxCells = 1000;
  const getCellsInSet = (cellSetName) => properties[cellSetName].cellIds;

  // return a set with all the cells found in group node
  // e.g: node = {key: louvain, children: []}, {...}

  const getCellsSetInGroup = (node) => {
    let cellIdsInAnyGroupBy = new Set();

    node.children.forEach(({ key }) => {
      const cellSet = getCellsInSet(key);
      // Union of allCellsInSets and cellSet
      cellIdsInAnyGroupBy = new Set([...cellIdsInAnyGroupBy, ...cellSet]);
    });
    return cellIdsInAnyGroupBy;
  };

  const downsampleWithProportions = (buckets, cellIdsLength) => {
    const downsampledCellIds = [];

    // If we collected less than `max` number of cells, let's go with that.
    const finalSampleSize = Math.min(cellIdsLength, maxCells);

    buckets.forEach((bucket) => {
      const sampleSize = Math.floor(
        (bucket.size / cellIdsLength) * finalSampleSize,
      );

      downsampledCellIds.push(..._.sampleSize(Array.from(bucket), sampleSize));
    });

    return downsampledCellIds;
  };

  const getCellSetIntersections = (cellSet, rootNode) => {
    const cellSetsOfRootNode = rootNode.children.map(({ key }) => getCellsInSet(key));
    const intersectionsSets = [];

    cellSetsOfRootNode.forEach((cellSetOfRootNode) => {
      const currentIntersection = new Set([...cellSet].filter((x) => cellSetOfRootNode.has(x)));

      if (currentIntersection.size > 0) { intersectionsSets.push(currentIntersection); }
    });

    return intersectionsSets;
  };

  const cartesianProductIntersection = (buckets, rootNode) => {
    const intersectedCellSets = [];

    buckets.forEach((currentCellSet) => {
      const currentCellSetIntersection = getCellSetIntersections(currentCellSet, rootNode);

      // The cellIds that werent part of any intersection are also added at the end
      const leftOverCellIds = currentCellSetIntersection
        .reduce((acum, current) => SetOperations.difference(acum, current), currentCellSet);

      currentCellSetIntersection.push(leftOverCellIds);

      intersectedCellSets.push(...currentCellSetIntersection);
    });

    return intersectedCellSets;
  };

  const getAllEnabledCellIds = () => {
    const { selectedCellSet, selectedPoints } = heatmapSettings;
    let cellIds;

    if (selectedPoints === 'All') {
      const selectedClusters = hierarchy.find(
        (clusters) => clusters.key === selectedCellSet,
      );
      cellIds = getCellsSetInGroup(selectedClusters);
    } else {
      const cellSetKey = selectedPoints.split('/')[1];
      cellIds = getCellsInSet(cellSetKey);
    }

    // Remove cells from groups marked as hidden by the user in the UI.
    const hiddenCellIds = union(Array.from(hidden), properties);
    const enabledCellIds = new Set([...cellIds]
      .filter((cellId) => !hiddenCellIds.has(cellId)));

    return enabledCellIds;
  };

  const splitByCartesianProductIntersections = (groupByRootNodes) => {
    // Beginning with only one set of all the cells that we want to see
    let buckets = [getAllEnabledCellIds()];

    // Perform successive cartesian product intersections across each groupby
    groupByRootNodes.forEach((currentRootNode) => {
      buckets = cartesianProductIntersection(
        buckets,
        currentRootNode,
      );
    });

    // We need to calculate size at the end because we may have repeated cells
    // (due to group bys having the same cell in different groups)
    const size = buckets.reduce((acum, currentBucket) => acum + currentBucket.size, 0);

    return { buckets, size };
  };

  const generateCellOrder = (groupByTracks) => {
    // Find the `groupBy` root nodes.

    // About the filtering: If we have failed to find some of the groupbys information,
    // then ignore those (this is useful for groupbys that sometimes dont show up, like 'samples')
    const groupByRootNodes = groupByTracks
      .map((groupByKey) => hierarchy.find((cluster) => (cluster.key === groupByKey)))
      .filter(((track) => track !== undefined));

    if (!groupByRootNodes.length) {
      return [];
    }
    const { buckets, size } = splitByCartesianProductIntersections(groupByRootNodes);

    if (downsampling) {
      return downsampleWithProportions(buckets, size);
    }

    const cellIds = [];
    buckets.forEach((bucket) => {
      cellIds.push(...bucket);
    });

    return cellIds;
  };
  // For now, this is statically defined. In the future, these values are
  // controlled from the settings panel in the heatmap.

  // Filter cellOrder so that it only contains cells which have been filtered
  const allLouvainCellIds = new Set(hierarchy[0].children.reduce(
    (acc, cellSet) => [
      ...acc,
      ...properties[cellSet.key].cellIds,
    ], [],
  ));

  // Do downsampling and return cellIds with their order by groupings.
  const cellOrder = generateCellOrder(groupedTracks)
    .filter((cellId) => allLouvainCellIds.has(cellId));
  const geneOrder = selectedGenes;

  if (!vitessce) {
    return generateVegaData(
      cellOrder, geneOrder, reversed(selectedTracks),
      expression, heatmapSettings, cellSets,
    );
  }

  return generateVitessceData(
    cellOrder, geneOrder, selectedTracks,
    expression, heatmapSettings, cellSets,
  );
};
export default populateHeatmapData;
