import { getBackendStatus } from 'redux/selectors';
import { PLOT_DATA_LOADED, PLOT_DATA_LOADING, PLOT_DATA_ERROR } from 'redux/actionTypes/componentConfig';

import handleError from 'utils/http/handleError';
import endUserMessages from 'utils/endUserMessages';
import fetchWork from 'utils/work/fetchWork';
import generateETag from 'utils/work/generateETag';
import getTimeoutForWorkerTask from 'utils/getTimeoutForWorkerTask';

const getTrajectoryPlotPseudoTime = (
  rootNodes,
  experimentId,
  plotUuid,
) => async (dispatch, getState) => {
  // Currenty monocle3 only trajectory analysis only supports
  // UMAP embedding. Therefore, this embedding is specifically fetched.
  const embeddingMethod = 'umap';

  const {
    clusteringSettings,
    embeddingSettings: { methodSettings },
  } = getState().experimentSettings.processing.configureEmbedding;

  const { environment } = getState().networkResources;
  const {
    pipeline:
    { startDate: qcPipelineStartDate },
  } = getBackendStatus(experimentId)(getState()).status;

  const embeddingBody = {
    name: 'GetEmbedding',
    type: embeddingMethod,
    config: methodSettings[embeddingMethod],
  };

  const embeddingETag = await generateETag(
    experimentId,
    embeddingBody,
    undefined,
    qcPipelineStartDate,
    environment,
    clusteringSettings,
    dispatch,
    getState,
  );

  const timeout = getTimeoutForWorkerTask(getState(), 'TrajectoryAnalysisPseudotime');

  const body = {
    name: 'GetTrajectoryAnalysisPseudoTime',
    embedding: {
      method: embeddingMethod,
      methodSettings: methodSettings[embeddingMethod],
      ETag: embeddingETag,
    },
    clustering: {
      method: clusteringSettings.method,
      resolution: clusteringSettings.methodSettings[clusteringSettings.method].resolution,
    },
    rootNodes,
  };

  try {
    dispatch({
      type: PLOT_DATA_LOADING,
      payload: { plotUuid },
    });

    const data = await fetchWork(
      experimentId, body, getState, dispatch, { timeout, rerun: true },
    );

    const { plotData } = getState().componentConfig[plotUuid];

    dispatch({
      type: PLOT_DATA_LOADED,
      payload: {
        plotUuid,
        plotData: {
          ...plotData,
          pseudotime: data.pseudotime,
        },
      },
    });

    return true;
  } catch (e) {
    const errorMessage = handleError(e, endUserMessages.ERROR_FETCHING_PLOT_DATA);

    dispatch({
      type: PLOT_DATA_ERROR,
      payload: {
        plotUuid,
        error: errorMessage,
      },
    });

    return false;
  }
};

export default getTrajectoryPlotPseudoTime;
