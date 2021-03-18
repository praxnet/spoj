const os = require("os");
const express = require("express");
const app = express();
const expressWs = require("express-ws")(app);
const pty = require("node-pty");
const fs = require("fs");
const child_process = require("child_process");
const bodyParser = require("body-parser");
const util = require("util");
const exec = util.promisify(require("child_process").exec);

const port = process.env.PORT || 3000;
const host = os.platform() === "win32" ? "127.0.0.1" : "0.0.0.0";

const terminals = {};

app.use(bodyParser.json());

app.get("/terminals/mock-exam/user-files", function (req, res) {
  child_process.execSync(`mkdir -p /tmp/results /root/results`);
  child_process.execSync(
    `cp -r /root/results/ /tmp/; cp /root/.kube/config /tmp/results`
  );
  child_process.execSync(`cd /tmp; zip -r results.zip results/*`);
  var filePath = "/tmp/results.zip";
  var stat = fs.statSync(filePath);

  res.writeHead(200, {
    "Content-Type": "application/zip",
    "Content-Length": stat.size,
  });

  var readStream = fs.createReadStream(filePath);
  // We replaced all the event handlers with a simple call to readStream.pipe()
  readStream.pipe(res);
});

app.post("/terminals/:terminalId/resize", (req, res) => {
  const terminalId = req.params.terminalId;
  const cols = parseInt(req.query.cols);
  const rows = parseInt(req.query.rows);
  const term = terminals[terminalId];

  term.resize(cols, rows);

  console.log(
    `Resized terminal ${terminalId} to ${cols} cols and ${rows} rows.`
  );

  res.end();
});

app.post("/terminals/execute", (req, res) => {
  exec(`export PATH=/.krew/bin:$PATH:/root/.krew/bin && cd "${req.body.path}" && ${req.body.command}`)
    .then((resp) => {
      res.setHeader("Content-Type", "application/json");
      res.send(JSON.stringify({ response: resp }));
      res.end();
    })
    .catch((error) => {
      const resp = { stdout: error.stdout, stderr: error.stderr };
      res.setHeader("Content-Type", "application/json");
      res.send(JSON.stringify({ response: resp }));
      res.end();
    });
});

app.get("/terminals/validate", function (req, res) {
  console.log("Incoming validation request");

  res.setHeader("Content-Type", "application/json");
  res.send(JSON.stringify({ success: true }));
  res.end();
});

app.get("/terminals/tutorial-menu-path-checker", function (req, res) {
  const { menuPath } = req.query;
  let exists = false;

  if (menuPath) {
    exists = fs.existsSync(menuPath);
  }

  console.log("Tutorial path", menuPath, "exists?", exists);

  res.setHeader("Content-Type", "application/json");
  res.send(JSON.stringify({ exists }));
  res.end();
});

app.ws("/terminals/:terminalId", function (ws, req) {
  const terminalId = req.params.terminalId;
  let term;

  if (terminals[terminalId]) {
    term = terminals[terminalId];
  } else {
    const cols = parseInt(req.query.cols);
    const rows = parseInt(req.query.rows);
    term = pty.spawn(process.platform === "win32" ? "cmd.exe" : "bash", [], {
      name: "xterm-color",
      cols: cols || 80,
      rows: rows || 24,
      cwd: process.env.PWD,
      env: process.env,
    });

    terminals[terminalId] = term;
  }

  console.log("Connected to terminal " + terminalId);

  term.on("data", (data) => {
    try {
      ws.send(data);
    } catch (ex) {
      // The websocket is not open ignore
    }
  });

  term.on("exit", (code, signal) => {
    term.kill();

    console.log("Closed terminal " + terminalId);

    // Clean things up
    delete terminals[terminalId];
  });

  ws.on("message", (msg) => {
    term.write(msg);
  });

  ws.on("close", () => {
    term.kill();

    console.log("Closed terminal " + terminalId);

    // Clean things up
    delete terminals[terminalId];
  });
});

app.listen(port, host);

console.log(
  "The internal Node.js terminal server is listening on internal port:",
  port
);
