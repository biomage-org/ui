import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  Table, Space,
} from 'antd';
import _ from 'lodash';
import PropTypes from 'prop-types';
import { changeGeneSelection } from 'redux/actions/genes';
import GeneSelectionStatus from 'redux/actions/genes/geneSelectionStatus';
import { geneTableUpdateReason } from 'utils/geneTable/geneTableUpdateReason';
import FocusButton from 'components/FocusButton';
import PlatformError from 'components/PlatformError';
import useLazyEffect from 'utils/customHooks/useLazyEffect';
import GeneSelectionMenu from 'components/data-exploration/generic-gene-table/GeneSelectionMenu';
import FilterGenes from 'components/data-exploration/generic-gene-table/FilterGenes';
import Loader from 'components/Loader';

const GeneTable = (props) => {
  const {
    experimentId, onUpdate, error, loading, columns, data, loadData,
    total, initialTableState, width, height, extraOptions,
  } = props;

  const dispatch = useDispatch();
  const selectedGenes = useSelector((state) => state.genes.selected);
  const [geneNameFilterState, setGeneNameFilterState] = useState({});

  const tableStateAllEntries = {
    pagination: {
      current: 1,
      pageSize: 1000000,
      showSizeChanger: true,
      total,
    },
    geneNamesFilter: null,
  }

  const [tableData, setTableData] = useState([]);

  useEffect(() => {
    setTableData(data);
  }, [data]);

  const [tableState, setTableState] = useState(
    _.merge(
      tableStateAllEntries,
      initialTableState,
    ),
  );

  // Load all entries and then set table state to display only 50
  useEffect(() => {
    loadData(tableStateAllEntries);
    setTableState(
      _.merge(
        {
          pagination: {
            current: 1,
            pageSize: 50,
            showSizeChanger: true,
            total,
          },
          geneNamesFilter: null,
        },
        initialTableState,
      )
    );
  }, []);

  useLazyEffect(() => {
    onUpdate(tableState, loading ? geneTableUpdateReason.loading : geneTableUpdateReason.loaded);
  }, [loading]);

  const getSortOrder = (key) => {
    if (key === tableState.sorter.columnKey) {
      return tableState.sorter.order;
    }
    return null;
  };

  const handleTableChange = (newPagination, a, newSorter) => {
    const newTableState = { ...tableState, pagination: newPagination, sorter: newSorter };

    // onUpdate(newTableState, geneTableUpdateReason.paginated);
    setTableState(newTableState);
  };

  const filterGenes = (filter) => {
    const { filterOption, text } = filter;

    let searchPattern;
    if (filterOption === 'Starts with') {
      searchPattern = '^'.concat(text);
    } else if (filterOption === 'Ends with') {
      searchPattern = text.concat('$');
    } else if (filterOption === 'Contains') {
      searchPattern = text;
    }


    // onUpdate(newTableState, geneTableUpdateReason.filtered);

    let newData = _.cloneDeep(data);
    newData = newData.filter(entry => entry.gene_names.includes(filter.text));

    const newTableState = {
      ...tableState,
      pagination: { ...tableState.pagination, current: 1, total: newData.length },
      geneNamesFilter: searchPattern,
    };

    setTableData(newData);
    setTableState(newTableState);
    setGeneNameFilterState(filter);
  };

  const rowSelection = {
    onSelect: (gene, selected) => {
      dispatch(changeGeneSelection(experimentId, [gene.key],
        (selected) ? GeneSelectionStatus.select : GeneSelectionStatus.deselect));
    },
    onSelectAll: (selected, selectedRows, changeRows) => {
      // changeRows returns the row objects for all genes that were affected
      // by the (de)selection event.
      const genes = [];
      changeRows.forEach((row) => genes.push(row.gene_names));

      dispatch(changeGeneSelection(experimentId, genes,
        (selected) ? GeneSelectionStatus.select : GeneSelectionStatus.deselect));
    },
  };

  /**
   * Render rows and decorate them appropriately (e.g., adding a focus button)
   */
  const renderRows = (rows) => rows.map((row) => {
    const key = row.gene_names;

    return {
      ...row,
      key,
      lookup: (
        <FocusButton
          experimentId={experimentId}
          store='genes'
          lookupKey={key}
        />
      ),
    };
  });

  /**
   * Render column data to be inserted into antd Table from a supplied column list.
   */
  const renderColumns = (propColumns) => {
    const baseColumns = [
      {
        fixed: 'left',
        title: '',
        dataIndex: 'lookup',
        key: 'lookup',
        width: '50px',
      },
      {
        fixed: 'left',
        title: 'Gene',
        dataIndex: 'gene_names',
        key: 'gene_names',
        sorter: true,
        showSorterTooltip: false,
        render: (geneName) => (
          <a
            href={`https://www.genecards.org/cgi-bin/carddisp.pl?gene=${geneName}`}
            target='_blank'
            rel='noreferrer'
          >
            {geneName}
          </a>
        ),
        sortOrder: getSortOrder('gene_names'),
      },
    ];

    const newColumns = propColumns.map((column) => {
      const modifiedColumn = { ...column, dataIndex: column.key };

      if (column.sorter) {
        modifiedColumn.sortOrder = getSortOrder(column.key);
      }

      return modifiedColumn;
    });

    return [...baseColumns, ...newColumns];
  };

  // The gene list couldn't load.
  if (error) {
    return (
      <PlatformError
        error={error}
        onClick={() => onUpdate(tableState, geneTableUpdateReason.retry)}
      />
    );
  }

  return (
    <Space
      direction='vertical'
      style={{ width: '100%' }}
    >
      {loading ? <></> : (
        <>
          <GeneSelectionMenu extraOptions={extraOptions} experimentId={experimentId} />
          <FilterGenes
            onFilter={filterGenes}
            defaultFilterOption={geneNameFilterState.filterOption}
            defaultFilterString={geneNameFilterState.text}
          />
        </>
      )}
      <Table
        columns={renderColumns(columns)}
        dataSource={renderRows(tableData)}
        loading={loading ? { indicator: <Loader experimentId={experimentId} /> } : loading}
        size='small'
        pagination={{ ...tableState?.pagination }}
        sorter={tableState?.sorter}
        scroll={{ x: width, y: height - 294 }}
        onChange={handleTableChange}
        rowSelection={{
          type: 'checkbox',
          selectedRowKeys: selectedGenes,
          ...rowSelection,
        }}
      />
    </Space>
  );
};

GeneTable.defaultProps = {
  initialTableState: {},
  extraOptions: null,
};

GeneTable.propTypes = {
  experimentId: PropTypes.string.isRequired,
  columns: PropTypes.array.isRequired,
  data: PropTypes.array.isRequired,
  loadData: PropTypes.func.isRequired,
  total: PropTypes.number.isRequired,
  error: PropTypes.PropTypes.oneOfType(
    [
      PropTypes.string,
      PropTypes.bool,
    ],
  ).isRequired,
  loading: PropTypes.bool.isRequired,
  onUpdate: PropTypes.func.isRequired,
  initialTableState: PropTypes.object,
  extraOptions: PropTypes.node,
  width: PropTypes.number.isRequired,
  height: PropTypes.number.isRequired,
};

export default GeneTable;
