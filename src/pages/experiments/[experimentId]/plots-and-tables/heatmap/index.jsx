import React, { useEffect, useState, useRef } from 'react';
import {
  Skeleton, Empty, Collapse, Space, Select, Button,
} from 'antd';
import _ from 'lodash';
import 'vega-webgl-renderer';

import { useSelector, useDispatch } from 'react-redux';
import { Vega } from 'react-vega';
import PropTypes from 'prop-types';
import { updatePlotConfig, loadPlotConfig } from 'redux/actions/componentConfig';
import Header from 'components/Header';
import PlotContainer from 'components/plots/PlotContainer';
import { generateSpec } from 'utils/plotSpecs/generateHeatmapSpec';
import { loadGeneExpression } from 'redux/actions/genes';
import { loadCellSets } from 'redux/actions/cellSets';
import PlatformError from 'components/PlatformError';
import Loader from 'components/Loader';
import populateHeatmapData from 'components/plots/helpers/heatmap/populateHeatmapData';
import { getCellSets, getCellSetsHierarchyByKeys } from 'redux/selectors';
import { plotNames } from 'utils/constants';
import SelectData from 'components/plots/styling/SelectData';
import HeatmapGroupBySettings from 'components/data-exploration/heatmap/HeatmapGroupBySettings';
import HeatmapMetadataTrackSettings from 'components/data-exploration/heatmap/HeatmapMetadataTrackSettings';
import PlotLegendAlert, { MAX_LEGEND_ITEMS } from 'components/plots/helpers/PlotLegendAlert';

import generateVegaData from 'components/plots/helpers/heatmap/vega/generateVegaData';

const { Panel } = Collapse;

const plotUuid = 'heatmapPlotMain';
const plotType = 'heatmap';

const HeatmapPlot = ({ experimentId }) => {
  const dispatch = useDispatch();
  const [vegaSpec, setVegaSpec] = useState();
  const displaySavedGenes = useRef(true);

  const config = useSelector((state) => state.componentConfig[plotUuid]?.config);
  const configIsLoaded = useSelector((state) => !_.isNil(state.componentConfig[plotUuid]));

  const { expression: expressionData } = useSelector((state) => state.genes);
  const { error, loading } = expressionData;
  const cellSets = useSelector(getCellSets());
  const selectedGenes = useSelector((state) => state.genes.expression.views[plotUuid]?.data) || [];
  const numLegendItems = useSelector(
    getCellSetsHierarchyByKeys([config?.selectedCellSet]),
  )[0]?.children?.length;

  useEffect(() => {
    dispatch(loadCellSets(experimentId));
    if (!config) dispatch(loadPlotConfig(experimentId, plotUuid, plotType));
  }, []);

  useEffect(() => {
    if (!config || _.isEmpty(expressionData)) {
      return;
    }

    if (!_.isEqual(selectedGenes, config.selectedGenes) && displaySavedGenes.current) {
      onGeneEnter(config.selectedGenes);
      displaySavedGenes.current = false;
    }
  }, [config]);

  const updatePlotWithChanges = (obj) => {
    dispatch(updatePlotConfig(plotUuid, obj));
  };

  useEffect(() => {
    if (!configIsLoaded
      || !cellSets.accessible
      || !config.legend.enabled) return;

    const showAlert = numLegendItems > MAX_LEGEND_ITEMS;

    if (showAlert) updatePlotWithChanges({ legend: { showAlert, enabled: !showAlert } });
  }, [configIsLoaded, cellSets.accessible]);

  useEffect(() => {
    if (!config || _.isEmpty(expressionData)) {
      return;
    }

    if (!_.isEqual(selectedGenes, config.selectedGenes) && !_.isEmpty(selectedGenes)) {
      updatePlotWithChanges({ selectedGenes });
    }
  }, [selectedGenes]);

  useEffect(() => {
    if (!config
      || !cellSets.accessible
      || _.isEmpty(expressionData)
      || _.isEmpty(selectedGenes)
      || !loading
    ) {
      return;
    }

    const cellOrder = populateHeatmapData(cellSets, config);
    const data = generateVegaData(cellOrder, expressionData, config, cellSets);

    const displayLabels = selectedGenes.length <= 53;
    const spec = generateSpec(config, 'Cluster ID', data, displayLabels);

    const extraMarks = { type: 'rule' };
    spec.description = 'Heatmap';
    spec.marks.push(extraMarks);

    setVegaSpec(spec);
  }, [expressionData, config, cellSets]);

  const onGeneEnter = (genes) => {
    // updating the selected genes in the config too so they are saved in dynamodb
    dispatch(loadGeneExpression(experimentId, genes, plotUuid));
  };

  const isCellSetEmpty = (cellSet) => {
    const chosenCellSet = cellSets.hierarchy.find(({ key }) => key === cellSet);
    return chosenCellSet.children.length === 0;
  };

  const plotStylingConfig = [
    {
      panelTitle: 'Expression values',
      controls: ['expressionValuesType', 'expressionValuesCapping'],
    },
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
      panelTitle: 'Colours',
      controls: ['colourScheme'],
    },
    {
      panelTitle: 'Legend',
      controls: [
        {
          name: 'legend',
          props: {
            option: {
              positions: 'horizontal-vertical',
            },
          },
        },
      ],
    },
  ];

  const renderExtraPanels = () => (
    <>
      <Panel header='Gene selection' key='gene-selection'>
        <p>Type in a gene name and hit space or enter to add it to the heatmap.</p>
        <Space direction='vertical' style={{ width: '100%' }}>
          <Select
            mode='tags'
            style={{ width: '100%' }}
            placeholder='Select genes...'
            onChange={onGeneEnter}
            value={selectedGenes}
            tokenSeparators={[' ']}
            notFoundContent='No gene added yet.'
          />

          <Button
            type='primary'
            onClick={() => { onGeneEnter([]); }}
          >
            Reset
          </Button>
        </Space>
      </Panel>
      <Panel header='Select data' key='select-data'>
        <SelectData
          config={config}
          onUpdate={updatePlotWithChanges}
          cellSets={cellSets}
          firstSelectionText='Select the cell sets or metadata to show expression for'
          secondSelectionText='Select the cell set, sample or metadata group to be shown'
        />
      </Panel>
      <Panel header='Metadata tracks' key='metadata-tracks'>
        <HeatmapMetadataTrackSettings componentType={plotUuid} />
      </Panel>
      <Panel header='Group by' key='group-by'>
        <HeatmapGroupBySettings componentType={plotUuid} />
      </Panel>
    </>
  );

  const renderPlot = () => {
    if (isCellSetEmpty(config.selectedCellSet)) {
      return (
        <center>
          <Empty description={(
            <>
              <p>
                There is no data to show.
              </p>
              <p>
                Select another option from the 'Select data' menu.
              </p>
            </>
          )}
          />
        </center>
      );
    }

    if (!config || loading.length > 0 || !cellSets.accessible) {
      return (
        <Loader experimentId={experimentId} />
      );
    }

    if (error) {
      return (
        <PlatformError
          description='Could not load gene expression data.'
          error={error}
          onClick={() => dispatch(loadGeneExpression(experimentId, selectedGenes, plotUuid))}
        />
      );
    }

    if (selectedGenes.length === 0) {
      return (
        <Empty description='Add some genes to this heatmap to get started.' />
      );
    }

    if (vegaSpec) {
      return (
        <Space direction='vertical'>
          {config.legend.showAlert
          && numLegendItems > MAX_LEGEND_ITEMS
          && <PlotLegendAlert />}
          <center>
            <Vega spec={vegaSpec} renderer='webgl' />
          </center>
        </Space>
      );
    }
  };

  if (!config || !cellSets.accessible) {
    return (<Skeleton />);
  }

  return (
    <>
      <Header title={plotNames.HEATMAP} />
      <PlotContainer
        experimentId={experimentId}
        plotUuid={plotUuid}
        plotType={plotType}
        plotStylingConfig={plotStylingConfig}
        extraControlPanels={renderExtraPanels()}
        defaultActiveKey='gene-selection'
      >
        {renderPlot()}
      </PlotContainer>
    </>
  );
};

HeatmapPlot.propTypes = {
  experimentId: PropTypes.string.isRequired,
};

export default HeatmapPlot;
