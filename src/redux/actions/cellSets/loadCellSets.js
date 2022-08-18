import fetchAPI from 'utils/http/fetchAPI';
import handleError from 'utils/http/handleError';
import {
  CELL_SETS_LOADED, CELL_SETS_LOADING, CELL_SETS_ERROR,
} from 'redux/actionTypes/cellSets';
import endUserMessages from 'utils/endUserMessages';

const loadCellSets = (experimentId, forceReload = false) => async (dispatch, getState) => {
  const {
    loading, error, updatingClustering, initialLoadPending,
  } = getState().cellSets;

  const { sampleIds: samplesOrder } = getState().experimentSettings.info;

  const loadingBlocked = loading || updatingClustering;
  const requiresLoading = initialLoadPending || error;

  const shouldLoad = requiresLoading && !loadingBlocked;

  if (!shouldLoad && !forceReload) {
    return;
  }

  dispatch({
    type: CELL_SETS_LOADING,
  });

  try {
    const data = await fetchAPI(`/v2/experiments/${experimentId}/cellSets`);

    // reordering cell sets based on the sampleIds recorded in the experiment table
    const samplesHierarchyIndex = data.cellSets.findIndex((cellSet) => cellSet.key === 'sample');
    data.cellSets[samplesHierarchyIndex].children.sort((a, b) => (
      samplesOrder.indexOf(a.key) - samplesOrder.indexOf(b.key)
    ));

    dispatch({
      type: CELL_SETS_LOADED,
      payload: {
        experimentId,
        data: data.cellSets,
      },
    });
  } catch (e) {
    const errorMessage = handleError(e, endUserMessages.ERROR_FETCHING_CELL_SETS);
    dispatch({
      type: CELL_SETS_ERROR,
      payload: { error: errorMessage },
    });
  }
};

export default loadCellSets;
