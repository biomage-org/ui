import _ from 'lodash';
import configureStore from 'redux-mock-store';
import fetchMock, { enableFetchMocks } from 'jest-fetch-mock';
import thunk from 'redux-thunk';

import bulkUpdateSampleOptions from 'redux/actions/samples/bulkUpdateSampleOptions';
import initialSamplesState, { sampleTemplate } from 'redux/reducers/samples/initialState';
import initialExperimentState, { experimentTemplate } from 'redux/reducers/experiments/initialState';

import {
  SAMPLES_BULK_OPTIONS_UPDATE,
  SAMPLES_ERROR, SAMPLES_SAVED, SAMPLES_SAVING,
} from 'redux/actionTypes/samples';

const mockStore = configureStore([thunk]);

const mockExperimentId = 'experiment-1';
const mockSampleIds = ['sample-1', 'sample-2'];

const mockSamples = mockSampleIds.reduce((acc, sampleId, idx) => {
  acc[sampleId] = {
    ...sampleTemplate,
    name: `test sample ${idx}`,
    uuid: `sampleId-${idx}`,
  };
  return acc;
}, { });

const mockState = {
  experiments: {
    ...initialExperimentState,
    ids: [mockExperimentId],
    [mockExperimentId]: {
      ...experimentTemplate,
      name: 'Mock experiment 1',
      sampleIds: mockSampleIds,
    },
    meta: {
      ...initialExperimentState.meta,
      activeExperimentId: mockExperimentId,
    },
  },
  samples: {
    ...initialSamplesState,
    ...mockSamples,
  },
};

const endpointUrl = `http://localhost:3000/v2/experiments/${mockExperimentId}/samples/bulkUpdate/options`;

describe('bulkUpdateSampleOptions action', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    enableFetchMocks();
    fetchMock.resetMocks();
    fetchMock.doMock();
  });

  it('Works correctly', async () => {
    fetchMock.mockResponseOnce(() => Promise.resolve(JSON.stringify({})));

    const sampleDiff = {
      includeAbseq: false,
    };

    const store = mockStore(mockState);

    await store.dispatch(bulkUpdateSampleOptions(mockExperimentId, sampleDiff));

    const actions = store.getActions();
    expect(_.map(actions, 'type')).toEqual([SAMPLES_SAVING, SAMPLES_SAVED, SAMPLES_BULK_OPTIONS_UPDATE]);
    expect(_.map(actions, 'payload')).toMatchSnapshot();

    expect(fetchMock).toHaveBeenCalledWith(
      endpointUrl,
      {
        body: JSON.stringify({
          sampleIds: mockSampleIds,
          options: sampleDiff,
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'PATCH',
      },
    );
  });

  it('Error handling works', async () => {
    fetchMock.mockRejectOnce(() => Promise.reject(new Error('Api error')));

    const sampleDiff = {
      name: 'updated name',
    };

    const store = mockStore(mockState);
    await store.dispatch(bulkUpdateSampleOptions(mockExperimentId, sampleDiff));

    const actions = store.getActions();
    expect(_.map(actions, 'type')).toEqual([SAMPLES_SAVING, SAMPLES_ERROR]);
    expect(_.map(actions, 'payload')).toMatchSnapshot();
  });
});
