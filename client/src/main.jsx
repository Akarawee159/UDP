// src/main.jsx
import '@ant-design/v5-patch-for-react-19';

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { App as AntdApp } from 'antd';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AntdApp>
      <App />
    </AntdApp>
  </React.StrictMode>
);
