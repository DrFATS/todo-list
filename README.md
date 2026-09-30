# Daymark

A small task-planning app with a responsive browser interface and an Express API. Tasks are stored in a local JSON file. The app contains no image or video assets.

## Run locally

```sh
npm install
npm start
```

Open <http://localhost:3000>. The server creates `data/tasks.json` with example tasks on first start. That folder is intentionally ignored by Git so personal or runtime task data is not published.

## Deploy

GitHub stores the source code but does not run this Express backend. To host the full app, push this repository to GitHub and create a Node web service on a host such as Render, connected to that repository. Set the build command to `npm install` and the start command to `npm start`.

The app writes task data to its `data/` directory. Attach persistent storage mounted at `/opt/render/project/src/data` or task changes can be lost when the service restarts or redeploys. On Render, persistent disks require a paid web service.

This is an intentionally public, shared board: anyone who can access the deployed URL can read, create, complete, and delete tasks. Do not enter private information.