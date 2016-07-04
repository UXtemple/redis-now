const childProcess = require('child_process');
const http = require('http');
const redis = require('then-redis');

const cwd = `${process.cwd()}/redis`;
let client;
let error;
let isBuilt = false;
let isReady = false;

function build() {
  return new Promise((resolve, reject) => {
    childProcess.exec('find . -name "*.sh" -exec chmod +x {} \\;', { cwd: process.cwd() }, err => {
      if (err) {
        reject(err);
      } else {
        childProcess.exec('make', { cwd }, err2 => {
          if (err2) {
            reject(err2);
          } else {
            isBuilt = true;
            resolve();
          }
        });
      }
    });
  });
}

function run() {
  return new Promise((resolve, reject) => {
    const redisServer = childProcess.spawn('src/redis-server', { cwd });
    redisServer.stdout.on('data', () => {
      isReady = true;
      resolve();
    });
    redisServer.stderr.on('data', err => {
      console.error(err);
      error = new Error(err);
    });
    redisServer.stderr.on('close', err => {
      console.error('close!');
      console.error(err);
      error = new Error(err);
    });
  });
}

function createClient() {
  client = redis.createClient();
}

build()
  .then(run)
  .then(createClient)
  .catch(err => {
    console.error(err);
    error = err
  });

function canIRedis() {
  let can = true;

  if (error) {
    can = error.stack;
  } else if (isBuilt) {
    if (!isReady) {
      can = 'running redis...';
    }
  } else {
    can = 'building redis...';
  }

  return can;
}

http.createServer(async (req, res) => {
  let data = canIRedis();

  if (data === true) {
    data = {
      cur: req.url,
      last: await client.get('last')
    };

    if (req.url !== '/favicon.ico') {
      client.set('last', req.url);
    }
  }

  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end(JSON.stringify(data));
}).listen(3000);
