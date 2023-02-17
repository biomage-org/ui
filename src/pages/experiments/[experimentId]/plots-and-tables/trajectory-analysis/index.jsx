/* eslint-disable no-param-reassign */
import React, {
  useEffect, useState, useRef,
} from 'react';
import _ from 'lodash';
import { useSelector, useDispatch } from 'react-redux';
import PropTypes from 'prop-types';
import { Button, Collapse, Space } from 'antd';
import {
  updatePlotConfig,
  loadPlotConfig,
} from 'redux/actions/componentConfig/index';
import Loader from 'components/Loader';
import { loadEmbedding } from 'redux/actions/embedding';
import { loadProcessingSettings } from 'redux/actions/experimentSettings';
import { loadCellSets } from 'redux/actions/cellSets';
import { getCellSets, getCellSetsHierarchyByKeys } from 'redux/selectors';

import getTrajectoryPlotStartingNodes from 'redux/actions/componentConfig/getTrajectoryPlotStartingNodes';

import Header from 'components/Header';
import PlotContainer from 'components/plots/PlotContainer';
import TrajectoryAnalysisPlot from 'components/plots/TrajectoryAnalysisPlot';
import PlatformError from 'components/PlatformError';

import { plotNames, plotTypes } from 'utils/constants';
import updateTrajectoryPlotSelectedNodes from 'redux/actions/componentConfig/updateTrajectoryPlotSelectedNodes';
import PlotLegendAlert, { MAX_LEGEND_ITEMS } from 'components/plots/helpers/PlotLegendAlert';
import TrajectoryAnalysisNodeSelector from './TrajectoryAnalysisNodeSelector';
import TrajectoryAnalysisDisplaySettings from './TrajectoryAnalysisDisplaySettings';
import MultipleCellSetSelection from './MultipleCellSetSelection';

const { Panel } = Collapse;

const plotUuid = 'trajectoryAnalysisMain';
const plotType = plotTypes.TRAJECTORY_ANALYSIS;

const initialDisplaySettings = {
  showStartingNodes: true,
  showPseudotimeValues: false,
  hasRunPseudotime: false,
};

const TrajectoryAnalysisPage = ({ experimentId }) => {
  const dispatch = useDispatch();
  const [displaySettings, setDisplaySettings] = useState(initialDisplaySettings);
  const resetZoomRef = useRef();

  // Currenty monocle3 trajectory analysis only supports
  // UMAP embedding. Therefore, this embedding is specifically fetched.
  const embeddingMethod = 'umap';

  const cellSets = useSelector(getCellSets());

  const plotLoading = useSelector((state) => state.componentConfig[plotUuid]?.loading);
  const legendEnabled = useSelector(
    (state) => state.componentConfig[plotUuid]?.config?.legend?.enabled,
  );
  const plotDataError = useSelector((state) => state.componentConfig[plotUuid]?.error);
  const configIsLoaded = useSelector((state) => !_.isNil(state.componentConfig[plotUuid]));
  const showLegendAlert = useSelector(
    (state) => state.componentConfig[plotUuid]?.config?.legend?.showAlert,
  );
  const selectedCellSets = useSelector(
    (state) => state.componentConfig[plotUuid]?.config?.selectedCellSets,
  );

  const embeddingSample = useSelector(
    (state) => state.componentConfig[plotUuid]?.config?.embeddingSample,
  );

  const embeddingSettings = useSelector(
    (state) => state.experimentSettings.originalProcessing
      ?.configureEmbedding?.embeddingSettings,
  );

  const numLegendItems = useSelector(
    getCellSetsHierarchyByKeys([embeddingSample]),
  )[0]?.children?.length;

  const {
    data: embeddingData,
    loading: embeddingLoading,
    error: embeddingError,
  } = useSelector((state) => state.embeddings[embeddingMethod]) || {};

  useEffect(() => {
    if (!configIsLoaded) {
      dispatch(loadPlotConfig(experimentId, plotUuid, plotType));
    }

    if (!cellSets.accessible) dispatch(loadCellSets(experimentId));
    if (!embeddingSettings) dispatch(loadProcessingSettings(experimentId));
  }, []);

  const updatePlotWithChanges = (obj) => {
    dispatch(updatePlotConfig(plotUuid, obj));
  };

  useEffect(() => {
    if (!configIsLoaded
      || !cellSets.accessible
      || !legendEnabled) return;

    const showAlert = numLegendItems > MAX_LEGEND_ITEMS;

    if (showAlert) updatePlotWithChanges({ legend: { showAlert, enabled: !showAlert } });
  }, [configIsLoaded, cellSets.accessible]);

  useEffect(() => {
    if (embeddingMethod
      && !embeddingData?.length
      && embeddingSettings
    ) {
      dispatch(loadEmbedding(experimentId, embeddingMethod));
    }
  }, [embeddingMethod, !embeddingSettings]);

  const plotStylingConfig = [
    {
      panelTitle: 'Main schema',
      controls: ['dimensions'],
      children: [
        {
          panelTitle: 'Title',
          controls: ['title'],
        },
        {
          panelTitle: 'Font',
          controls: ['font'],
        },
      ],
    },
    {
      panelTitle: 'Axes and margins',
      controls: ['axesWithRanges'],
    },
    {
      panelTitle: 'Colours',
      controls: displaySettings.showPseudotimeValues
        ? ['colourScheme', 'colourInversion']
        : ['colourInversion'],
    },
    {
      panelTitle: 'Markers',
      controls: ['markers'],
    },
    {
      panelTitle: 'Legend',
      controls: [{
        name: 'legend',
        props: {
          option: {
            positions: 'top-bottom',
          },
        },
      }],
    },
    !displaySettings.showPseudotimeValues && {
      panelTitle: 'Labels',
      controls: ['labels'],
    },
  ];

  const render = () => {
    if (cellSets.error) {
      return (
        <PlatformError
          error={cellSets.error}
          onClick={() => { dispatch(loadCellSets(experimentId)); }}
        />
      );
    }

    if (embeddingError) {
      return (
        <PlatformError
          error={embeddingError}
          onClick={() => { dispatch(loadEmbedding(experimentId, embeddingSettings?.method)); }}
        />
      );
    }

    if (plotDataError) {
      return (
        <PlatformError
          error={plotDataError}
          onClick={() => { dispatch(loadEmbedding(experimentId, embeddingSettings?.method)); }}
        />
      );
    }

    if (embeddingLoading
      || plotLoading
      || !cellSets.accessible
      || !embeddingData
    ) {
      return (
        <center>
          <Loader experimentId={experimentId} />
        </center>
      );
    }

    return (
      <Space direction='vertical'>
        { showLegendAlert && numLegendItems > MAX_LEGEND_ITEMS && <PlotLegendAlert />}
        <TrajectoryAnalysisPlot
          ref={resetZoomRef}
          experimentId={experimentId}
          plotUuid={plotUuid}
          onUpdate={updatePlotWithChanges}
          displaySettings={displaySettings}
          plotLoading={plotLoading}
          plotDataError={plotDataError}
          onClickNode={handleClickNode}
          onLassoSelection={handleLassoSelection}
          actions={{ export: true, editor: false, source: false }}
        />
      </Space>
    );
  };

  const renderExtraToolbarControls = () => (
    <>
      <Button
        size='small'
        onClick={() => {
          resetZoomRef.current.resetZoom();
        }}
      >
        Reset Zoom
      </Button>
    </>
  );

  const handleClickNode = (action, selectedNodeId) => {
    dispatch(updateTrajectoryPlotSelectedNodes(plotUuid, [selectedNodeId], action));
  };

  const handleLassoSelection = (nodesInLasso) => {
    dispatch(updateTrajectoryPlotSelectedNodes(plotUuid, nodesInLasso, 'add'));
  };

  return (
    <>
      <Header title={plotNames.TRAJECTORY_ANALYSIS} />
      <PlotContainer
        experimentId={experimentId}
        plotUuid={plotUuid}
        plotType={plotType}
        plotStylingConfig={plotStylingConfig}
        extraToolbarControls={renderExtraToolbarControls()}
        defaultActiveKey='select-data'
        saveDebounceTime={10}
        extraControlPanels={(
          <>
            <Panel header='Select data' key='select-data'>
              <MultipleCellSetSelection
                experimentId={experimentId}
                plotUuid={plotUuid}
                selectedCellSets={selectedCellSets}
                setSelectedCellSets={
                  (chosenCellSets) => { updatePlotWithChanges({ selectedCellSets: chosenCellSets }); }
                }
                extraElements={(
                  <Button
                    type='primary'
                    onClick={() => {
                      dispatch(getTrajectoryPlotStartingNodes(experimentId, plotUuid, selectedCellSets));
                    }}
                  >
                    Calculate root nodes
                  </Button>
                )}
              />
            </Panel>
            <Panel header='Select root nodes' key='select-root-nodes'>
              <TrajectoryAnalysisNodeSelector
                experimentId={experimentId}
                plotUuid={plotUuid}
                setDisplaySettings={setDisplaySettings}
                displaySettings={displaySettings}
              />
            </Panel>
            <Panel header='Display' key='display'>
              <TrajectoryAnalysisDisplaySettings
                experimentId={experimentId}
                plotUuid={plotUuid}
                setDisplaySettings={setDisplaySettings}
                displaySettings={displaySettings}
              />
            </Panel>
          </>
        )}
        onPlotReset={() => {
          setDisplaySettings(initialDisplaySettings);
          resetZoomRef.current.resetZoom();
        }}
        plotInfo={(
          <>
            Trajectory inference (TI) or pseudotemporal ordering is a computational technique used in single-cell transcriptomics to determine the pattern of a dynamic process experienced by cells and then arrange cells based on their progression through the process by projecting the cells onto an axis called pseudotime. A “trajectory” shows the path of the progression. Currently, Trajectory Analysis is implemented using the
            {' '}
            <a href='https://cole-trapnell-lab.github.io/monocle3/'> Monocle3 </a>
            {' '}
            workflow.
          </>
        )}
      >
        {render()}
      </PlotContainer>
    </>
  );
};
TrajectoryAnalysisPage.propTypes = {
  experimentId: PropTypes.string.isRequired,
};

export default TrajectoryAnalysisPage;
