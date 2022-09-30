import React, { useState } from 'react';
import { Button, Dropdown, Card } from 'antd';
import { QuestionCircleOutlined, DownOutlined } from '@ant-design/icons';
import nextConfig from 'next/config';

import config from 'config';
import { AccountId } from 'utils/deploymentInfo';

const accountId = nextConfig()?.publicRuntimeConfig?.accountId;

const HelpButton = () => {
  const [visible, setVisible] = useState(false);

  const overlay = () => (
    <Card size='small' style={{ padding: '1em', width: '265px' }}>
      {accountId !== AccountId.HMS && (
        <>
          Ask questions about how to use Cellenics and make feature requests on the
          {' '}
          <a href='https://community.biomage.net/'>Cellenics community forum</a>
          !
          The Biomage team will reply to your message as soon as possible.
          <br />
          <br />
          Check out the
          {' '}
          <a href='https://www.biomage.net/user-guide'>
            user guide
          </a>
          {' '}
          and
          <a href='https://www.biomage.net/resources'> tutorial videos </a>
          that are available on our website!
          <br />
          <br />
        </>
      )}
    </Card>
  );

  return (
    <Dropdown
      visible={visible}
      onVisibleChange={(v) => setVisible(v)}
      overlay={overlay}
      placement='bottomRight'
      trigger='click'
    >
      <Button
        type='dashed'
        icon={<QuestionCircleOutlined />}
      >
        Need help?
        <DownOutlined />
      </Button>
    </Dropdown>
  );
};

export default HelpButton;
