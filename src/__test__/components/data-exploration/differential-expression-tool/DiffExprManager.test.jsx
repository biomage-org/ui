import React from 'react';
import { mount } from 'enzyme';
import { act } from 'react-dom/test-utils';
import { Provider } from 'react-redux';
import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import DiffExprManager from 'components/data-exploration/differential-expression-tool/DiffExprManager';
import DiffExprCompute from 'components/data-exploration/differential-expression-tool/DiffExprCompute';
import DiffExprResults from 'components/data-exploration/differential-expression-tool/DiffExprResults';
import initialState from 'redux/reducers/differentialExpression/initialState';
import genesInitialState from 'redux/reducers/genes/initialState';
import cellSetsInitialState from 'redux/reducers/cellSets/initialState';

const mockStore = configureMockStore([thunk]);

const emptyState = {
  differentialExpression: { ...initialState },
  cellSets: {
    ...cellSetsInitialState,
    hierarchy: [],
    properties: {},
  },
  genes: {
    ...genesInitialState,
    focused: undefined,
  },
};

const experimentId = '1234';

const backendStatus = {
  [experimentId]: {
    status: {
      pipeline: {
        startDate: '2021-01-01T00:00:00',
      },
    },
  },
};

const filledState = {
  genes: {
    selected: [],
  },
  cellInfo: {
    focus: {
      store: 'genes',
      key: 'C',
    },
  },
  cellSets: {
    loading: false,
    error: false,
    selected: [],
    properties: {
      'cluster-a': {
        name: 'Name of Cluster A',
        key: 'cluster-a',
        cellIds: new Set([1, 2]),
        color: '#00FF00',
      },
      'cluster-b': {
        name: 'Name of Cluster B',
        key: 'cluster-b',
        cellIds: new Set([2, 3, 4, 5]),
        color: '#FF0000',
      },
      'scratchpad-a': {
        cellIds: new Set([3]),
        key: 'scratchpad-a',
        name: 'Name of Scratchpad A',
        color: '#ff00ff',
      },
      louvain: {
        cellIds: new Set(),
        name: 'Louvain clusters',
        key: 'louvain',
        type: 'cellSets',
        rootNode: true,
      },
      scratchpad: {
        cellIds: new Set(),
        name: 'Custom selections',
        key: 'scratchpad',
        type: 'cellSets',
        rootNode: true,
      },
      sample: {
        cellIds: new Set(),
        name: 'Sample',
        key: 'sample',
        type: 'metadataCategorical',
        rootNode: true,
      },
      'sample-a': {
        cellIds: new Set([1, 2, 3, 4, 5]),
        key: 'sample-a',
        name: 'Name of Sample A',
        type: undefined,
        color: '#ff00ff',
      },
    },
    hierarchy: [
      {
        key: 'louvain',
        children: [{ key: 'cluster-a' }, { key: 'cluster-b' }],
      },
      {
        key: 'scratchpad',
        children: [{ key: 'scratchpad-a' }],
      },
      {
        key: 'sample',
        children: [{ key: 'sample-a' }],
      },
    ],
  },
  differentialExpression: {
    properties: {
      data: [
        {
          p_val: 1.496, p_val_adj: 1.647, logFC: -1.427, gene_names: 'A', auc: '0.1', pct_1: '100', pct_2: '100',
        },
        {
          p_val: 2.496, p_val_adj: 2.647, logFC: -2.427, gene_names: 'B', auc: '0.2', pct_1: '90', pct_2: '90',
        },
        {
          p_val: 3.496, p_val_adj: 3.647, logFC: -3.427, gene_names: 'C', auc: '0.3', pct_1: '80', pct_2: '80',
        },
        {
          p_val: 4.496, p_val_adj: 4.647, logFC: -4.427, gene_names: 'D', auc: '0.4', pct_1: '70', pct_2: '70',
        },
        {
          p_val: 5.496, p_val_adj: 5.647, logFC: -5.427, gene_names: 'E', auc: '0.5', pct_1: '60', pct_2: '60',
        },
      ],
      loading: false,
      error: false,
      total: 5,
    },
    comparison: {
      type: 'between',
      group: {
        between: {
          cellSet: 'louvain/cluster-a',
          compareWith: 'louvain/cluster-b',
          basis: 'scratchpad/scratchpad-a',
        },
      },
      advancedFilters: [],
    },
  },
  backendStatus,
};

const emptyStore = mockStore(emptyState);
const filledStore = mockStore(filledState);

describe('DiffExprManager', () => {
  it('renders correctly a compute view', () => {
    const component = mount(
      <Provider store={emptyStore}>
        <DiffExprManager experimentId='1234' view='compute' width={100} height={200} />
      </Provider>,
    );
    expect(component.find(DiffExprCompute).length).toEqual(1);
  });

  it('on click of compute with changed parameters, DiffExprManager calls the results view', () => {
    const component = mount(
      <Provider store={filledStore}>
        <DiffExprManager experimentId='1234' view='compute' width={100} height={200} />
      </Provider>,
    );

    expect(component.find(DiffExprResults).length).toEqual(0);
    expect(component.find(DiffExprCompute).length).toEqual(1);

    act(() => {
      component.find(DiffExprCompute).props().onCompute();
    });
    component.update();

    const results = component.find(DiffExprResults);
    expect(results.length).toEqual(1);

    expect(component.find(DiffExprCompute).length).toEqual(0);
  });

  it('on click of go back, DiffExprManager calls the compute view', () => {
    const component = mount(
      <Provider store={filledStore}>
        <DiffExprManager experimentId='1234' view='compute' width={100} height={200} />
      </Provider>,
    );

    act(() => {
      component.find(DiffExprCompute).props().onCompute();
    });
    component.update();

    act(() => {
      component.find(DiffExprResults).props().onGoBack();
    });
    component.update();

    expect(component.find(DiffExprResults).length).toEqual(0);
    expect(component.find(DiffExprCompute).length).toEqual(1);
  });
});
