/* eslint-disable import/no-duplicates */
import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import moment from 'moment';
import {
  Modal, Button, Col, Row,
} from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { useDispatch } from 'react-redux';
import { saveAs } from 'file-saver';
import { Storage } from 'aws-amplify';
import { uploadSingleFile } from '../../utils/upload/processUpload';
import pushNotificationMessage from '../../utils/pushNotificationMessage';
import UploadStatus, { messageForStatus } from '../../utils/upload/UploadStatus';
import { bundleToFile } from '../../utils/upload/processUpload';

// we'll need to remove the hard-coded 10x tech type once we start
// supporting other types and save the chosen tech type in redux
const SELECTED_TECH = '10X Chromium';

const UploadDetailsModal = (props) => {
  const dispatch = useDispatch();
  const {
    sampleName, visible, onCancel, uploadDetailsModalDataRef, activeProjectUuid,
  } = props;
  const { fileCategory, sampleUuid } = uploadDetailsModalDataRef.current || false;
  const file = uploadDetailsModalDataRef.current?.file || {};
  const {
    upload = {}, bundle = {},
  } = file;
  const status = upload?.status;
  const bundleName = bundle?.name;
  const inputFileRef = useRef(null);
  const [replacementFileBundle, setReplacementFileBundle] = useState(null);

  useEffect(() => {
    if (replacementFileBundle) {
      bundleToFile(replacementFileBundle, SELECTED_TECH).then((newFile) => {
        if (newFile.valid) { // && newFile.name === file.name ?
          uploadFileBundle(newFile);
        } else {
          pushNotificationMessage('error',
            'The selected file name does not match the expected category.', 2);
        }
      });
    }
  }, [replacementFileBundle]);

  const isSuccessModal = status === UploadStatus.UPLOADED;
  const isNotUploadedModal = status === UploadStatus.FILE_NOT_FOUND;

  const toMBytes = (sizeInBytes) => (sizeInBytes / (1000 * 1000)).toFixed(2);

  const fromISODateToFormatted = (ISOStringDate) => {
    const date = moment(ISOStringDate);

    const weekDayName = date.format('dddd');

    const fullDate = date.local().format('DD MMM YYYY');
    const fullTime = date.local().format('HH:mm');

    return `${weekDayName}, ${fullDate} at ${fullTime}`;
  };

  const downloadFile = async () => {
    const bucketKey = `${activeProjectUuid}/${sampleUuid}/${file.name}`;

    const downloadedS3Object = await Storage.get(bucketKey, { download: true });

    const fileNameToSaveWith = bundleName.endsWith('.gz') ? bundleName : `${bundleName}.gz`;

    saveAs(downloadedS3Object.Body, fileNameToSaveWith);
  };

  const uploadFileBundle = (newFile) => {
    if (!uploadDetailsModalDataRef.current) {
      return;
    }
    uploadSingleFile(newFile, activeProjectUuid, sampleUuid, dispatch);
    onCancel();
  };

  const retryButton = () => (
    <Button
      type='primary'
      key='retry'
      block
      onClick={() => {
        uploadFileBundle(bundle);
      }}
      style={{ width: '140px', marginBottom: '10px' }}
    >
      Retry upload
    </Button>
  );

  const replaceButton = () => (
    <>
      <input
        type='file'
        id='file'
        ref={inputFileRef}
        style={{ display: 'none' }}
        onChange={
          (event) => {
            const newFile = event.target.files[0];
            if (!newFile) {
              return;
            }
            setReplacementFileBundle(newFile);
          }
        }
      />
      <Button
        type='primary'
        key='replace'
        block
        icon={<UploadOutlined />}
        onClick={() => {
          inputFileRef.current.click();
        }}
        style={{ width: '140px', marginBottom: '10px' }}
      >
        {/* Button text to be "Upload" if the file was never uploaded */}
        {!isNotUploadedModal ? 'Replace file' : 'Upload'}
      </Button>
    </>
  );

  const downloadButton = () => (
    <Button
      type='primary'
      key='retry'
      block
      onClick={() => {
        downloadFile();
      }}
      style={{ width: '140px', marginBottom: '10px' }}
    >
      Download
    </Button>
  );

  return (
    <Modal
      title={!isNotUploadedModal ? (isSuccessModal ? 'Upload successful' : 'Upload error') : 'File not found'}
      visible={visible}
      onCancel={onCancel}
      width='40%'
      footer={(
        <Row style={{ width: '100%', justifyContent: 'center' }}>
          <Col>
            {/* render retry button only if file was tried to be uploaded */}
            {!isNotUploadedModal && (isSuccessModal ? downloadButton() : retryButton())}
          </Col>
          <Col span='2' />
          {replaceButton()}
          <Col />
        </Row>
      )}
    >
      <div style={{ width: '100%', marginLeft: '15px' }}>
        {!isSuccessModal
          && (
            <Row style={{ marginTop: '5px', marginBottom: '5px' }}>
              The following file
              {' '}
              {isNotUploadedModal ? 'was not uploaded' : 'has failed to upload'}
            </Row>
          )}
        <Row style={{ marginTop: '5px', marginBottom: '5px' }}>
          <Col span={5}>Sample</Col>
          <Col span={10}>{sampleName}</Col>
        </Row>
        <Row style={{ marginTop: '5px', marginBottom: '5px' }}>
          <Col span={5}>Category</Col>
          <Col span={10}>{fileCategory}</Col>
        </Row>
        {!isNotUploadedModal && (
          <Row style={{ marginTop: '5px', marginBottom: '5px' }}>
            <Col span={5}>Filename</Col>
            <Col span={10}>{file.name}</Col>
          </Row>
        )}

        {
          isSuccessModal ? (
            <>
              <Row style={{ marginTop: '5px', marginBottom: '5px' }}>
                <Col span={5}>File size</Col>
                <Col span={10}>
                  {toMBytes(bundle.size)}
                  {' '}
                  MB
                </Col>
              </Row>
              <Row style={{ marginTop: '5px', marginBottom: '5px' }}>
                <Col span={5}>Upload date</Col>
                <Col span={10}>{fromISODateToFormatted(file.lastModified)}</Col>
              </Row>
            </>
          )
            : (
              <Row style={{ marginTop: '5px', marginBottom: '5px' }}>
                <Col span={5}>Error</Col>
                <Col span={10}>{messageForStatus(status)}</Col>
              </Row>
            )
        }
      </div>
    </Modal>
  );
};

UploadDetailsModal.propTypes = {
  sampleName: PropTypes.string,
  file: PropTypes.object,
  visible: PropTypes.bool,
  onCancel: PropTypes.func,
  activeProjectUuid: PropTypes.string.isRequired,
  uploadDetailsModalDataRef: PropTypes.object.isRequired,
};

UploadDetailsModal.defaultProps = {
  sampleName: '',
  file: {},
  visible: true,
  onCancel: () => { },
};

export default UploadDetailsModal;
