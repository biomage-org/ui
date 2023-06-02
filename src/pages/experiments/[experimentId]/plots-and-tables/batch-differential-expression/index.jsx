import React, {
  useEffect, useState, useCallback,
} from 'react';
import {
  Radio,
  Tooltip,
  Select,
  Space,
  Button,
  Card,
  Form,
} from 'antd';
import Header from 'components/Header';
import { getCellSetsHierarchyByType, getCellSets, getCellSetsHierarchyByKeys } from 'redux/selectors';
import { useSelector, useDispatch } from 'react-redux';
import { loadCellSets } from 'redux/actions/cellSets';
import PropTypes from 'prop-types';
import { InfoCircleOutlined } from '@ant-design/icons';
import { plotNames } from 'utils/constants';
import Loader from 'components/Loader';
import DiffExprSelect from 'components/data-exploration/differential-expression-tool/DiffExprSelect';
import getBatchDiffExpr from 'utils/extraActionCreators/differentialExpression/getBatchDiffExpr';
import { zipSync } from 'fflate';
import { saveAs } from 'file-saver';
import _ from 'lodash';
import { metadataKeyToName } from 'utils/data-management/metadataUtils';

const comparisonTypes = {
  fullList: 'within',
  compareForCellSets: 'within',
  compareForSamples: 'within',
};
const comparisonInitialState = {
  cellSet: null,
  compareWith: null,
  basis: null,
  comparisonType: null,
};

const BatchDiffExpression = (props) => {
  const { experimentId } = props;
  const [chosenOperation, setChosenOperation] = useState('fullList');
  const dispatch = useDispatch();
  const cellSets = useSelector(getCellSets());
  const experimentName = useSelector((state) => state.experimentSettings.info.experimentName);
  const cellSetNodes = useSelector(getCellSetsHierarchyByType('cellSets'));
  const metadataCellSetNodes = useSelector(getCellSetsHierarchyByType('metadataCategorical'));

  const [dataLoading, setDataLoading] = useState();

  const [comparison, setComparison] = useState(comparisonInitialState);
  const batchCellSetKeys = useSelector(getCellSetsHierarchyByKeys([comparison.basis]))[0]?.children
    .map((child) => child.key);

  const isDatasetUnisample = (useSelector((state) => (
    state.experimentSettings.info.sampleIds.length)) === 1);

  useEffect(() => {
    dispatch(loadCellSets(experimentId));
  }, []);

  useEffect(() => {
    changeComparison({
      ...comparisonInitialState,
      comparisonType: comparisonTypes[chosenOperation],
    });
    setDataLoading(false);
    setChosenOperation(chosenOperation);
  }, [chosenOperation]);

  const changeComparison = (diff) => {
    setComparison({
      ...comparison,
      ...diff,
    });
  };

  const isFormInvalid = useCallback(() => {
    const { cellSet, compareWith, basis } = comparison;
    if (!basis) return true;

    if (cellSet && compareWith && basis) {
      return false;
    }

    if (chosenOperation === 'fullList' && basis) {
      return false;
    }
    return true;
  }, [comparison, chosenOperation]);

  const downloadCSVsAsZip = (data) => {
    const encoder = new TextEncoder();
    const archiveName = `batchDE_${experimentName}`;
    const CSVs = data.reduce((accumulator, currentData, indx) => {
      // Get the column names from the keys of the first object in currentData
      const columnNames = Object.keys(currentData[0]).join(',');
      const csvRows = currentData.map((obj) => Object.values(obj).join(','));

      // Add the column names as the first row and join the CSV data with new lines
      const csvString = `${columnNames}\n${csvRows.join('\n')}`;
      const fileName = `DE-${batchCellSetKeys[indx]}.csv`;

      const encodedString = encoder.encode(csvString);
      accumulator[fileName] = encodedString;
      return accumulator;
    }, {});

    const zipped = zipSync({ [archiveName]: CSVs });

    const blob = new Blob([zipped], { type: 'application/zip' });
    saveAs(blob, archiveName);
  };

  const getSelectOptions = useCallback((options) => {
    const selectOptions = [];
    if (options?.length === 0) return;

    Array.from(options).forEach((option) => {
      selectOptions.push({
        value: option.key,
        label: _.upperFirst(metadataKeyToName(option.name)),
      });
    });
    return selectOptions;
  }, []);

  const getData = async () => {
    setDataLoading(true);
    const data = await dispatch(
      getBatchDiffExpr(experimentId, comparison, chosenOperation, batchCellSetKeys),
    );
    setDataLoading(false);
    downloadCSVsAsZip(data);
  };

  const renderSpecificControls = (operation) => {
    switch (operation) {
      case 'fullList':
        return (
          <>
            <div>Select the cell sets for which marker genes are to be computed in batch:</div>
            <br />
            <Select
              placeholder='Select a cell set...'
              onChange={(value) => changeComparison({ basis: value })}
              value={comparison.basis}
              style={{ width: '40%' }}
              options={getSelectOptions(cellSetNodes)}
            />
            <br />
          </>
        );
      case 'compareForCellSets':
        return (
          <>
            Select the comparison sample/groups for which batch
            differential expression is to be computed:
            <br />
            <DiffExprSelect
              title='Compare sample/group:'
              option='cellSet'
              filterType='metadataCategorical'
              onSelectCluster={(cellSet) => changeComparison({ cellSet })}
              selectedComparison={{ cellSet: comparison.cellSet }}
              value={comparison.cellSet}
              cellSets={cellSets}
            />
            <DiffExprSelect
              title='To sample/group:'
              option='compareWith'
              filterType='metadataCategorical'
              onSelectCluster={(cellSet) => changeComparison({ compareWith: cellSet })}
              selectedComparison={{ cellSet: comparison.cellSet }}
              value={comparison.compareWith}
              cellSets={cellSets}
            />

            In batch for each cell set in:
            <Select
              placeholder='Select a cell set...'
              onChange={(value) => changeComparison({ basis: value })}
              value={comparison.basis}
              style={{ width: '33.5%' }}
              options={getSelectOptions(cellSetNodes)}
            />
          </>
        );
      case 'compareForSamples':
        return (
          <>
            Select the comparison cell sets for which batch
            differential expression is to be computed:
            <br />
            <DiffExprSelect
              title='Compare cell set:'
              option='cellSet'
              filterType='cellSets'
              onSelectCluster={(cellSet) => changeComparison({ cellSet })}
              selectedComparison={{ cellSet: comparison.cellSet }}
              value={comparison.cellSet}
              cellSets={cellSets}
            />
            <DiffExprSelect
              title='To cell set:'
              option='compareWith'
              filterType='cellSets'
              onSelectCluster={(cellSet) => changeComparison({ compareWith: cellSet })}
              selectedComparison={{ cellSet: comparison.cellSet }}
              value={comparison.compareWith}
              cellSets={cellSets}
            />

            In batch for each sample/group in:
            <Select
              placeholder='Select samples or metadata...'
              onChange={(value) => changeComparison({ basis: value })}
              value={comparison.basis}
              style={{ width: '34%' }}
              options={getSelectOptions(metadataCellSetNodes)}
            />
          </>
        );
      default:
        return (<h1>Invalid option</h1>);
    }
  };

  if (!cellSets.accessible) {
    return (
      <center>
        <Loader experimentId={experimentId} />
      </center>
    );
  }
  return (
    <div width='60%'>
      <Header title={plotNames.BATCH_DIFFERENTIAL_EXPRESSION} />
      <Card>
        <div> Select the batch differential expression calculation to perform:</div>
        {' '}
        <br />
        <Form size='small' layout='vertical'>

          <Radio.Group
            value={chosenOperation}
            onChange={(e) => { setChosenOperation(e.target.value); }}
          >
            <Space direction='vertical'>
              <Space direction='horizontal'>
                <Radio value='fullList'>
                  Generate a full list of marker genes for all cell sets
                  {'   '}
                  <Tooltip title='Each cell set will be compared to all other cells, using all samples.'>
                    <InfoCircleOutlined />
                  </Tooltip>
                </Radio>
              </Space>
              <Radio value='compareForCellSets' disabled={isDatasetUnisample}>
                {
                  isDatasetUnisample ? (
                    <Tooltip
                      overlay={(
                        <span>
                          Comparison between samples/groups is
                          not possible with a dataset that contains only 1 sample
                        </span>
                      )}
                    >
                      Compare two selected samples/groups within a cell set for all cell sets
                    </Tooltip>
                  ) : (
                    'Compare two selected samples/groups within a cell set for all cell sets'
                  )
                }
              </Radio>
              <Radio value='compareForSamples'>
                Compare two cell sets for all samples/groups
              </Radio>
            </Space>
          </Radio.Group>

          <br />
          <br />
          <Space direction='vertical'>
            {renderSpecificControls(chosenOperation)}
            <br />
            <Space direction='horizontal'>
              <Button
                disabled={isFormInvalid() === true}
                loading={dataLoading}
                size='large'
                type='primary'
                onClick={() => getData()}
              >
                Compute and Download
              </Button>
            </Space>
            This might take several minutes to complete.
          </Space>
        </Form>
      </Card>
    </div>
  );
};

BatchDiffExpression.propTypes = {
  experimentId: PropTypes.string.isRequired,
};

export default BatchDiffExpression;
