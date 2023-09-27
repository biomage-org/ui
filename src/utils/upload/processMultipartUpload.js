import axios from 'axios';

const FILE_CHUNK_SIZE = 10000000;
const MAX_RETRIES = 2;

const putPartInS3 = async (blob, signedUrl, onUploadProgress, currentRetry = 0) => {
  try {
    return await axios.request({
      method: 'put',
      data: blob,
      url: signedUrl,
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      onUploadProgress,
    });
  } catch (e) {
    if (currentRetry < MAX_RETRIES) {
      return await putPartInS3(blob, signedUrl, onUploadProgress, currentRetry + 1);
    }

    throw e;
  }
};

const processMultipartUpload = async (file, signedUrls, createOnUploadProgressForPart) => {
  const promises = [];

  signedUrls.forEach((signedUrl, index) => {
    const start = index * FILE_CHUNK_SIZE;
    const end = (index + 1) * FILE_CHUNK_SIZE;
    const blob = index < signedUrls.length
      ? file.fileObject.slice(start, end)
      : file.fileObject.slice(start);

    const req = putPartInS3(blob, signedUrl, createOnUploadProgressForPart(index));
    promises.push(req);
  });

  const resParts = await Promise.all(promises);

  return resParts.map((part, index) => ({
    ETag: part.headers.etag,
    PartNumber: index + 1,
  }));
};
export { putPartInS3 };
export default processMultipartUpload;
