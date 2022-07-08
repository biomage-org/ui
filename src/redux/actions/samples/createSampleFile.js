import moment from 'moment';
import { v4 as uuidv4 } from 'uuid';

import fetchAPI from 'utils/http/fetchAPI';
import { SAMPLES_FILE_UPDATE } from 'redux/actionTypes/samples';
import handleError from 'utils/http/handleError';
import endUserMessages from 'utils/endUserMessages';

const fileNameForApiV1 = {
  matrix10x: 'matrix.mtx.gz',
  barcodes10x: 'barcodes.tsv.gz',
  features10x: 'features.tsv.gz',
  seurat: 'r.rds',
};

const createSampleFile = (
  experimentId,
  sampleId,
  type,
  size,
  metadata,
  fileForApiV1,
) => async (dispatch) => {
  const updatedAt = moment().toISOString();

  console.log(`sampleId: ${sampleId}`);
  console.log(`type: ${type}`);
  console.log(`size: ${size}`);
  console.log(`metadata: ${metadata}`);
  console.log(`fileForApiV1: ${fileForApiV1}`);

  try {
    const url = `/v2/experiments/${experimentId}/samples/${sampleId}/sampleFiles/${type}`;
    const body = {
      sampleFileId: uuidv4(),
      size,
      metadata,
    };

    const signedUrl = await fetchAPI(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );

    console.log('HERE!!!--====');
    console.log('type:', type);

    dispatch({
      type: SAMPLES_FILE_UPDATE,
      payload: {
        sampleUuid: sampleId,
        lastModified: updatedAt,
        fileName: fileNameForApiV1[type],
        fileDiff: fileForApiV1,
      },
    });

    return signedUrl;
  } catch (e) {
    // Can't update the upload status becuase we didn't even get to create the sample file
    handleError(e, endUserMessages.ERROR_BEGIN_SAMPLE_FILE_UPLOAD);

    throw e;
  }
};

export default createSampleFile;
