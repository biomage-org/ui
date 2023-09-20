import dayjs from 'dayjs';

import getAuthJWT from 'utils/getAuthJWT';
import fetchAPI from 'utils/http/fetchAPI';
import unpackResult from 'utils/work/unpackResult';
import parseResult from 'utils/work/parseResult';
import WorkTimeoutError from 'utils/errors/http/WorkTimeoutError';
import WorkResponseError from 'utils/errors/http/WorkResponseError';
import { updateBackendStatus } from 'redux/actions/backendStatus';
import cache from 'utils/cache';

const throwResponseError = (response) => {
  throw new Error(`Error ${response.status}: ${response.text}`, { cause: response });
};

const downloadFromS3 = async (signedUrl, taskName) => {
  const storageResp = await fetch(signedUrl);

  if (!storageResp.ok) {
    throwResponseError(storageResp);
  }

  const unpackedResult = await unpackResult(storageResp, taskName);
  return parseResult(unpackedResult, taskName);
};

const timeoutIds = {};

// getTimeoutDate returns the date resulting of adding 'timeout' seconds to
// current time.
const getTimeoutDate = (timeout) => dayjs().add(timeout, 's').toISOString();

// set a timeout and save its ID in the timeoutIds map
// if there was a timeout for the current ETag, clear it before reseting it
const setOrRefreshTimeout = (request, timeoutDuration, reject, ETag) => {
  if (timeoutIds[ETag]) {
    clearTimeout(timeoutIds[ETag]);
  }

  // timeoutDate needs to be initialized outside the timeout callback
  // or it will be computed when the error is raised instead of (now)
  // when the timeout is set
  const timeoutDate = getTimeoutDate(timeoutDuration);
  timeoutIds[ETag] = setTimeout(() => {
    reject(new WorkTimeoutError(timeoutDuration, timeoutDate, request, ETag));
  }, timeoutDuration * 1000);
};

const getWorkerTimeout = (taskName, defaultTimeout) => {
  switch (taskName) {
    case 'GetEmbedding':
    case 'ListGenes':
    case 'MarkerHeatmap': {
      return dayjs().add(1800, 's').toISOString();
    }

    default: {
      return dayjs().add(defaultTimeout, 's').toISOString();
    }
  }
};

// getRemainingWorkerStartTime returns how many more seconds the worker is expected to
// need to be running with an extra 1 minute for a bit of leeway
const getRemainingWorkerStartTime = (creationTimestamp) => {
  const now = new Date();
  const creationTime = new Date(creationTimestamp);
  const elapsed = parseInt((now - creationTime) / (1000), 10); // gives second difference

  // we assume a worker takes up to 5 minutes to start
  const totalStartup = 5 * 60;
  const remainingTime = totalStartup - elapsed;
  // add an extra minute just in case
  return remainingTime + 60;
};

const dispatchWorkRequest = async (
  experimentId,
  body,
  timeout,
  ETag,
  requestProps,
  dispatch,
) => {
  const { default: connectionPromise } = await import('utils/socketConnection');
  const io = await connectionPromise;

  const { name: taskName } = body;

  // for listGenes, markerHeatmap, & getEmbedding we set a long timeout for the worker
  // after that timeout the worker will skip those requests
  // meanwhile in the UI we set a shorter timeout. The UI will be prolonging this timeout
  // as long as it receives "heartbeats" from the worker because that means the worker is alive
  // and progresing.
  // this should be removed if we make each request run in a different worker
  const workerTimeoutDate = getWorkerTimeout(taskName, timeout);
  const authJWT = await getAuthJWT();

  const request = {
    ETag,
    socketId: io.id,
    experimentId,
    ...(authJWT && { Authorization: `Bearer ${authJWT}` }),
    timeout: workerTimeoutDate,
    body,
    ...requestProps,
  };

  const timeoutPromise = new Promise((resolve, reject) => {
    setOrRefreshTimeout(request, timeout, reject, ETag);

    io.on(`WorkerInfo-${experimentId}`, (res) => {
      const { response: { podInfo: { creationTimestamp, phase } } } = res;
      const extraTime = getRemainingWorkerStartTime(creationTimestamp);

      // this worker info indicates that the work request has been received but the worker
      // is still spinning up so we will add extra time to account for that.
      if (phase === 'Pending' && extraTime > 0) {
        const newTimeout = timeout + extraTime;
        setOrRefreshTimeout(request, newTimeout, reject, ETag);
      }
    });

    // this experiment update is received whenever a worker finishes any work request
    // related to the current experiment. We extend the timeout because we know
    // the worker is alive and was working on another request of our experiment
    io.on(`Heartbeat-${experimentId}`, (message) => {
      const newTimeoutDate = getTimeoutDate(timeout);
      if (newTimeoutDate < workerTimeoutDate) {
        const status = {
          worker: {
            statusCode: message.status_code,
            userMessage: message.user_message,
          },
        };
        dispatch(updateBackendStatus(experimentId, status));

        setOrRefreshTimeout(request, timeout, reject, ETag);
      }
    });
  });

  const responsePromise = new Promise((resolve, reject) => {
    io.on(`WorkResponse-${ETag}`, (res) => {
      const { response } = res;

      if (response.error) {
        const { errorCode, userMessage } = response;
        console.error(errorCode, userMessage);

        return reject(
          new WorkResponseError(errorCode, userMessage, request),
        );
      }

      // If no error, the response should be ready on S3.
      // In this case, return true
      return resolve();
    });
  });

  const result = Promise.race([timeoutPromise, responsePromise]);

  // TODO switch to using normal WorkRequest for v2 requests
  io.emit('WorkRequest-v2', request);

  return result;
};

const seekWorkerResultsOrDispatchWork = async (
  experimentId,
  body,
  timeout,
  requestProps,
  ETagProps,
  onETagGenerated,
  dispatch,
) => {
  let url = `/v2/workResults/${experimentId}`;
  const { ETag, signedUrl } = await fetchAPI(url, ETagProps);

  onETagGenerated(ETag);

  // First, let's try to fetch this information from the local cache.
  const data = await cache.get(ETag);

  if (data) {
    return { ETag, data };
  }

  // If a signed url is returned, we know that results already exist
  if (signedUrl) {
    return { ETag, data: await downloadFromS3(signedUrl) };
  }

  // Otherwise subscribe to the worker socket using the Etag
  try {
    await dispatchWorkRequest(
      experimentId,
      body,
      timeout,
      ETag,
      requestProps,
      dispatch,
    );
    url = `v2/getSignedUrl/${experimentId}/${ETag}`;
    const { signedUrl: newSignedUrl } = await fetchAPI(url);
    return { ETag, data: await downloadFromS3(newSignedUrl) };
  } catch (error) {
    console.error('Error dispatching work request', error);
    throw error;
  }
};

export default seekWorkerResultsOrDispatchWork;
