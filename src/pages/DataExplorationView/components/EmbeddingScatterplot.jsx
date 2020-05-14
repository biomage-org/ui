import React, { useEffect, useState } from 'react';

// eslint-disable-next-line import/no-extraneous-dependencies, import/extensions
import { Scatterplot } from 'vitessce/build-lib/es/production/scatterplot.min.js';
// eslint-disable-next-line import/no-extraneous-dependencies
import 'vitessce/build-lib/es/production/static/css/index.css';

import { v4 as uuidv4 } from 'uuid';
import { Spin } from 'antd';
import { connectionPromise } from '../../../components/content-wrapper/ContentWrapper';

const EmbeddingScatterplot = () => {
  const uuid = 'my-scatterplot';
  const view = { target: [0, 0, 0], zoom: 0.75 };

  const [cells, setCells] = useState([]);

  const cellColors = null;
  const mapping = 'PCA';
  const selectedCellIds = new Set();
  // eslint-disable-next-line no-unused-vars
  const updateCellsHover = (hoverInfo) => { };
  // eslint-disable-next-line no-unused-vars
  const updateCellsSelection = (selectedIds) => { console.log(selectedIds); };
  // eslint-disable-next-line no-unused-vars
  const updateStatus = (message) => { };
  // eslint-disable-next-line no-unused-vars
  const updateViewInfo = (viewInfo) => { };
  // eslint-disable-next-line no-unused-vars
  const clearPleaseWait = (layerName) => { };

  const convertData = (results) => {
    const data = {};

    results.forEach((result, i) => {
      data[i] = {
        mappings: {
          PCA: result,
        },
      };
    });

    return data;
  };

  useEffect(() => {
    if (cells.length !== 0) {
      return;
    }

    connectionPromise().then((io) => {
      const requestUuid = uuidv4();

      const request = {
        uuid: requestUuid,
        socketId: io.id,
        experimentId: '5e959f9c9f4b120771249001',
        timeout: '2021-01-01T00:00:00Z',
        body: {
          name: 'GetEmbedding',
          type: 'pca',
        },
      };

      io.emit('WorkRequest', request);

      console.log('emitted!!!');

      io.on(`WorkResponse-${requestUuid}`, (res) => {
        console.log('response!');
        let embedding = JSON.parse(res.results[0].body);
        embedding = convertData(embedding);
        setCells(embedding);
      });
    });
  });

  if (cells.length === 0) {
    return (<center><Spin size="large" /></center>);
  }

  return (
    <div className="vitessce-container vitessce-theme-light" style={{ height: '50vh', position: 'relative' }}>
      <Scatterplot
        uuid={uuid}
        view={view}
        cells={cells}
        mapping={mapping}
        selectedCellIds={selectedCellIds}
        cellColors={cellColors}
        updateStatus={updateStatus}
        updateCellsSelection={updateCellsSelection}
        updateCellsHover={updateCellsHover}
        updateViewInfo={updateViewInfo}
        clearPleaseWait={clearPleaseWait}
      />
    </div>
  );
};

export default EmbeddingScatterplot;