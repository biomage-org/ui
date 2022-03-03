import React from 'react';
import { mount } from 'enzyme';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import { Provider } from 'react-redux';
import { Vega } from 'react-vega';

import { ClipLoader } from 'react-spinners';
import changeEmbeddingAxesIfNecessary from 'components/plots/helpers/changeEmbeddingAxesIfNecessary';
import ContinuousEmbeddingPlot from 'components/plots/ContinuousEmbeddingPlot';
import { initialEmbeddingState } from 'redux/reducers/embeddings/initialState';
import initialCellSetsState from 'redux/reducers/cellSets/initialState';
import initialGeneExpressionState from 'redux/reducers/genes/initialState';
import generateExperimentSettingsMock from '__test__/test-utils/experimentSettings.mock';
import { initialPlotConfigStates } from 'redux/reducers/componentConfig/initialState';
import { mockCellSets } from '__test__/test-utils/cellSets.mock';

jest.mock('components/plots/helpers/changeEmbeddingAxesIfNecessary');

const mockStore = configureStore([thunk]);

const initialExperimentState = generateExperimentSettingsMock([]);
const mockOnUpdate = jest.fn();
describe('Continuous embedding plot', () => {
  const config = initialPlotConfigStates.embeddingContinuous;
  const experimentId = 'asd';
  const shownGene = 'CST3';
  const plotUuid = 'fakeUuid';
  const mockedStore = {
    cellSets: {
      ...initialCellSetsState,
      ...mockCellSets,
      loading: false,
      error: false,
    },
    componentConfig: {
      [plotUuid]: config,
    },
    embeddings: {
      ...initialEmbeddingState,
      umap: {
        data: [
          [0, 1],
          [2, 3],
          [4, 5],
          [6, 7],
          [8, 9],
          [10, 11],
        ],
        loading: false,
        error: false,
      },
    },
    genes: {
      ...initialGeneExpressionState,
      expression: {
        loading: [],
        error: false,
        data: {
          [shownGene]: {
            min: 1,
            max: 6,
            mean: 3.5,
            stdev: 1.870828693387,
            expression: [
              0, 1, 2, 3, 4, 5,
            ],
          },
        },
      },
    },
    experimentSettings: {
      ...initialExperimentState,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    changeEmbeddingAxesIfNecessary.mockImplementation(() => ({}));
  });

  it('shows spinner when data is still loading', () => {
    const store = mockStore(mockedStore);

    const plotData = mockedStore.genes.expression.data[shownGene].expression;

    const component = mount(
      <Provider store={store}>
        <ContinuousEmbeddingPlot
          experimentId={experimentId}
          config={config}
          plotUuid={plotUuid}
          truncatedPlotData={plotData}
          plotData={plotData}
          loading
          error={mockedStore.genes.expression.error}
          onUpdate={mockOnUpdate}
        />
      </Provider>,
    );

    const spin = component.find(ClipLoader);

    // There should be a spinner for loading state.
    expect(spin.length).toEqual(1);
    expect(changeEmbeddingAxesIfNecessary).toHaveBeenCalled();
  });

  it('renders correctly when data is in the store', () => {
    const store = mockStore(mockedStore);

    const plotData = mockedStore.genes.expression.data[shownGene].expression;

    const component = mount(
      <Provider store={store}>
        <ContinuousEmbeddingPlot
          experimentId={experimentId}
          config={config}
          plotUuid={plotUuid}
          truncatedPlotData={plotData}
          plotData={plotData}
          loading={false}
          error={mockedStore.genes.expression.error}
          onUpdate={mockOnUpdate}
        />
      </Provider>,
    );

    // There should no spinner anymore.
    const spin = component.find(ClipLoader);
    expect(spin.length).toEqual(0);

    // There should be a form loaded.
    const form = component.find(Vega);
    expect(form.length).toBeGreaterThan(0);
    expect(changeEmbeddingAxesIfNecessary).toHaveBeenCalled();
  });
});
