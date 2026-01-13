// ./src/components/common/StatusIcon.jsx
import React from 'react';
import { CheckCircleTwoTone, CloseCircleTwoTone } from '@ant-design/icons';

const StatusIcon = ({ ok, show }) => {
  if (!show) return null;
  return ok ? (
    <CheckCircleTwoTone twoToneColor="#52c41a" />
  ) : (
    <CloseCircleTwoTone twoToneColor="#ff4d4f" />
  );
};

export default StatusIcon;