import "regenerator-runtime/runtime";
import React from "react";
import ReactDOM from "react-dom/client";
import AppConfigured from "./components/app-configured";
import { StorageHelper } from "./common/helpers/storage-helper";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
// import { StagewiseToolbar } from '@stagewise/toolbar-react';

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);

const theme = StorageHelper.getTheme();
StorageHelper.applyTheme(theme);

root.render(
  <React.StrictMode>
    <AppConfigured />
  </React.StrictMode>
);

// const stagewiseConfig = {
//   plugins: []
// };

// if (process.env.NODE_ENV === 'development') {
//   let toolbarRoot = document.getElementById('stagewise-toolbar-root');
//   if (!toolbarRoot) {
//     toolbarRoot = document.createElement('div');
//     toolbarRoot.id = 'stagewise-toolbar-root';
//     document.body.appendChild(toolbarRoot);
//   }
//   const toolbarReactRoot = ReactDOM.createRoot(toolbarRoot);
//   toolbarReactRoot.render(
//     <StagewiseToolbar config={stagewiseConfig} />
//   );
// }
