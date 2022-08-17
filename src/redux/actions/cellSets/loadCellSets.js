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
  console.log('SAMPLES ORDER ', samplesOrder);
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
    console.log('DATA IS ', samplesOrder);

    // const samplesHierarchyIndex = data.cellSets.findIndex((cellSet) => cellSet.key === 'sample');
    // const samplesOrderedObject = samplesOrder.map((id) => ({ key: id }));
    // data.cellSets[samplesHierarchyIndex].children = samplesOrderedObject;

    const cellSetsSorted = data.cellSets.sort((a, b) => (
      samplesOrder.indexOf(b.key) - samplesOrder.indexOf(a.key)
    ));

    console.log('DAR CELSLSETS ', data.cellSets, cellSetsSorted);
    dispatch({
      type: CELL_SETS_LOADED,
      payload: {
        experimentId,
        data: data.cellSets,
      },
    });
  } catch (e) {
    const errorMessage = handleError(e, endUserMessages.ERROR_FETCHING_CELL_SETS);
    console.log('ERRORRR ', e);
    dispatch({
      type: CELL_SETS_ERROR,
      payload: { error: errorMessage },
    });
  }
};

export default loadCellSets;
