import { v4 as uuidv4 } from 'uuid';
import fetchMock, { enableFetchMocks } from 'jest-fetch-mock';
import { seekFromAPI } from '../../utils/work/seekWorkResponse';

/**
 * jest.mock calls are automatically hoisted to the top of the javascript
 * during compilation. Accordingly, `mockEmit` and `mockOn` as exported
 * from jest.mock will be accessible under `socketConnectionMocks`, even
 * if they do not appear in the original file.
 */
import * as socketConnectionMocks from '../../utils/socketConnection';

enableFetchMocks();
uuidv4.mockImplementation(() => 'my-random-uuid');

jest.mock('uuid');
jest.mock('moment', () => () => jest.requireActual('moment')('4022-01-01T00:00:00.000Z'));
jest.mock('../../utils/socketConnection', () => {
  const mockEmit = jest.fn();
  const mockOn = jest.fn();

  return {
    __esModule: true,
    default: new Promise((resolve) => {
      resolve({ emit: mockEmit, on: mockOn, id: '5678' });
    }),
    mockEmit,
    mockOn,
  };
});

jest.mock('aws-amplify', () => ({
  configure: jest.fn().mockImplementation(() => ({
    Storage: {
      AWSS3: {
        bucket: 'biomage-originals-test',
      },
    },
  })),
  Storage: {
    get: jest.fn().mockImplementation(async () => 'http://clearly-invalid-url'),
  },
}));

describe('seekFromAPI unit tests', () => {
  const experimentId = '1234';
  const timeout = 30;
  const body = {
    name: 'ImportantTask',
    type: 'fake task',
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  beforeEach(() => {
    fetchMock.resetMocks();
    fetchMock.doMock();
    fetchMock.mockResolvedValue(
      new Response('Mock S3 cache miss', { status: 404, statusText: 'Not Found' }),
    );

    socketConnectionMocks.mockOn.mockImplementation(async (x, f) => {
      f({
        results: [
          {
            body: JSON.stringify({
              hello: 'world',
            }),
          },
        ],
        response: { error: false },
      });
    });
  });

  it('Sends work to the backend when called and returns valid response.', async () => {
    const response = await seekFromAPI(
      experimentId, body, timeout, 'facefeed',
    );

    expect(socketConnectionMocks.mockEmit).toHaveBeenCalledWith('WorkRequest', {
      ETag: 'facefeed',
      socketId: '5678',
      experimentId: '1234',
      timeout: '4022-01-01T00:00:30.000Z',
      body: { name: 'ImportantTask', type: 'fake task' },
    });

    expect(socketConnectionMocks.mockOn).toHaveBeenCalledTimes(1);
    expect(response).toEqual({
      results: [{ body: '{"hello":"world"}' }],
      response: { error: false },
    });
  });

  it('Returns an error if there is error in the response.', async (done) => {
    const flushPromises = () => new Promise(setImmediate);

    socketConnectionMocks.mockOn.mockImplementation(async (x, f) => {
      f({
        results: [
          {
            body: JSON.stringify({
              hello: 'world 2',
            }),
          },
        ],
        response: { error: 'The backend returned an error' },
      });
    });

    expect(seekFromAPI(experimentId, body, timeout, 'deadbeef')).rejects.toEqual(new Error('The backend returned an error'));
    await flushPromises();

    expect(socketConnectionMocks.mockEmit).toHaveBeenCalledWith('WorkRequest', {
      ETag: 'facefeed',
      socketId: '5678',
      experimentId: '1234',
      timeout: '4022-01-01T00:00:30.000Z',
      body: { name: 'ImportantTask', type: 'fake task' },
    });

    done();
  });
});
