const BACKEND_STATUS = 'backendStatus';

/**
 * Starts loading pipeline status from the API.
 */
const BACKEND_STATUS_LOADING = `${BACKEND_STATUS}/backendStatusLoading`;

/**
 * Loaded pipeline status from the API.
 */
const BACKEND_STATUS_LOADED = `${BACKEND_STATUS}/backendStatusLoaded`;

/**
 * Error state when backend status could not be loaded from the API.
 */
const BACKEND_STATUS_ERROR = `${BACKEND_STATUS}/backendStatusError`;

export {
  BACKEND_STATUS_LOADING,
  BACKEND_STATUS_LOADED,
  BACKEND_STATUS_ERROR,
};
